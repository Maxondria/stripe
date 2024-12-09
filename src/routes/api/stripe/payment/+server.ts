import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_PRICE_ID } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
	apiVersion: '2024-11-20.acacia'
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Create or get existing customer
		const customers = await stripe.customers.list({ email: body.email });

		let customer = customers.data[0];

		if (!customer) {
			customer = await stripe.customers.create({
				email: body.email,
				name: body.name ?? '',
				payment_method: body.paymentMethodId,
				invoice_settings: {
					default_payment_method: body.paymentMethodId
				}
			});
		}

		// Create the subscription
		const subscription = await stripe.subscriptions.create({
			customer: customer.id,
			items: [{ price: STRIPE_PRICE_ID }],
			payment_behavior: 'default_incomplete',
			collection_method: 'charge_automatically',
			payment_settings: {
				payment_method_types: ['card'],
				save_default_payment_method: 'on_subscription'
			},
			expand: ['latest_invoice.payment_intent'],
			metadata: {
				profile_id: body.profileId ?? ''
			}
		});

		// Type guard to ensure invoice and payment intent exist
		const invoice = subscription.latest_invoice;

		if (!invoice || typeof invoice === 'string') {
			throw new Error('Latest invoice not expanded');
		}

		const paymentIntent = invoice.payment_intent;

		if (!paymentIntent || typeof paymentIntent === 'string') {
			throw new Error('Payment intent not expanded');
		}

		return json(
			{
				subscriptionId: subscription.id,
				clientSecret: paymentIntent.client_secret
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Payment intent creation failed:', error);
		return json({ error: 'Failed to create payment intent' }, { status: 500 });
	}
};
