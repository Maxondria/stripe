import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
	apiVersion: '2024-11-20.acacia'
});

const customerIds = new Map<string, { customerId: string; paymentMethodId: string }>();

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const email = 'test@test.com';

		const customerExists = await stripe.customers.list({
			email
		});

		if (customerExists.data.length > 0) {
			console.log({ customerExists });
			customerIds.set(email, {
				customerId: customerExists.data[0].id,
				paymentMethodId: body.paymentMethodId
			});
			return json({ message: 'Customer already exists' }, { status: 200 });
		}

		// create a new customer
		const customer = await stripe.customers.create({
			email,
			name: 'Test Customer',
			payment_method: body.paymentMethodId,
			invoice_settings: {
				default_payment_method: body.paymentMethodId
			}
		});

		customerIds.set(email, {
			customerId: customer.id,
			paymentMethodId: body.paymentMethodId
		});

		console.log({ customer });

		return json({ message: 'Customer created successfully' }, { status: 200 });
	} catch (error) {
		console.error('Payment intent creation failed:', error);
		return json({ error: 'Failed to create payment intent' }, { status: 500 });
	}
};
