import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
	apiVersion: '2024-11-20.acacia'
});

/**
 * Payment Confirmation Approaches
 *
 * There are two strategies for handling Stripe payment confirmation:
 *
 * @description
 * 1. Automatic Confirmation (current implementation)
 *    - Server-side confirmation using `confirm: true`
 *    - Simpler flow but less flexible for complex scenarios
 *
 * 2. Manual Confirmation
 *    - If `confirm: false`, the we would need to return a clientSecret to the frontend
 *    - Client confirms payment via Stripe.js
 *    - Better UX for 3D Secure and payment failures
 *
 * @example
 * // Manual confirmation flow:
 * async function handlePayment() {
 *     try {
 *         // Create PaymentIntent
 *         const { clientSecret } = await fetch('/api/stripe/payment', {
 *             method: 'POST',
 *             headers: { 'Content-Type': 'application/json' },
 *             body: JSON.stringify({
 *                 amount: 1999,  // $19.99
 *                 currency: 'usd'
 *             })
 *         }).then(r => r.json());
 *
 *         // Confirm payment client-side
 *         const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
 *             payment_method: {
 *                 card,
 *                 billing_details: { name: customerName, email: customerEmail etc }
 *             }
 *         });
 *
 *         if (error) throw error;
 *         if (paymentIntent.status === 'succeeded') {
 *             // Handle successful payment
 *         }
 *     } catch (error) {
 *         // Handle payment failure
 *     }
 * }
 */

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const amount = 1000;
		const currency = 'usd';
		const paymentMethodType = 'card';

		// Validate the amount
		if (!amount || amount <= 0) {
			return json({ error: 'Invalid amount provided' }, { status: 400 });
		}

		// Create a payment intent
		const paymentIntent = await stripe.paymentIntents.create({
			amount: Math.round(amount * 100), // Convert to cents
			currency,
			payment_method_types: [paymentMethodType],
			payment_method: body.paymentMethodId,
			// It going to automatically confirm the payment - see above explanation
			confirm: true,
			receipt_email: body.email ?? 'test@test.com', // Email to send the receipt to
			error_on_requires_action: true,
			// Here can pass anything to the user
			metadata: {
				profile_id: body.profileId ?? ''
			}
		});

		console.log(JSON.stringify(paymentIntent, null, 2));

		return json(
			{
				message: 'Payment intent created successfully'
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Payment intent creation failed:', error);
		return json({ error: 'Failed to create payment intent' }, { status: 500 });
	}
};
