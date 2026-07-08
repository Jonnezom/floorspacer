import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// service_role key — bypasses RLS, this is the only place allowed to write `tier`.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('DB_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    if (!userId) {
      console.error('checkout.session.completed with no supabase_user_id metadata', session.id);
      return new Response('Missing metadata', { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        tier: 'paid',
        unlocked_at: new Date().toISOString(),
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      })
      .eq('id', userId);

    if (error) {
      console.error('Failed to update profile tier:', error);
      return new Response('DB update failed', { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
