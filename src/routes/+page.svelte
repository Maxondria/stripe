<script lang="ts">
	import {
		loadStripe,
		type Stripe,
		type StripeCardCvcElement,
		type StripeCardExpiryElement,
		type StripeCardNumberElement,
		type StripeElements
	} from '@stripe/stripe-js';
	import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';
	import { onDestroy } from 'svelte';
	import StripeCardField from '$lib/components/StripeCardField.svelte';

	let stripe: Stripe | null = $state(null);
	let elements: StripeElements | null = $state(null);

	let cardNumberElement: StripeCardNumberElement | null = null;
	let cardExpiryElement: StripeCardExpiryElement | null = null;
	let cardCvcElement: StripeCardCvcElement | null = null;

	let cardNumberRef: HTMLDivElement | null = $state(null);
	let cardExpiryRef: HTMLDivElement | null = $state(null);
	let cardCvcRef: HTMLDivElement | null = $state(null);

	let cardHolderName = $state('');
	let cardHolderState = $state('');
	let cardType = $state<
		'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unknown' | 'unionpay'
	>('unknown');

	let errors = $state<{
		cardNumber: string | null;
		cardExpiry: string | null;
		cardCvc: string | null;
	}>({
		cardNumber: null,
		cardExpiry: null,
		cardCvc: null
	});

	let isSuccess = $state(false);
	let isPaying = $state(false);
	let isError = $state(false);
	let focusedElement = $state<'cardNumber' | 'cardExpiry' | 'cardCvc' | null>(null);

	const setupCardNumberEventListeners = (element: StripeCardNumberElement) => {
		element.on('change', (event) => {
			cardType = event.brand;
			errors.cardNumber = event.error?.message ?? null;
		});
		element.on('focus', () => (focusedElement = 'cardNumber'));
		element.on('blur', () => (focusedElement = null));
	};

	const setupCardExpiryEventListeners = (element: StripeCardExpiryElement) => {
		element.on('change', (event) => (errors.cardExpiry = event.error?.message ?? null));
		element.on('focus', () => (focusedElement = 'cardExpiry'));
		element.on('blur', () => (focusedElement = null));
	};

	const setupCardCvcEventListeners = (element: StripeCardCvcElement) => {
		element.on('change', (event) => (errors.cardCvc = event.error?.message ?? null));
		element.on('focus', () => (focusedElement = 'cardCvc'));
		element.on('blur', () => (focusedElement = null));
	};

	$effect(() => {
		loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY)
			.then((stripeInstance) => {
				if (!stripeInstance) {
					console.error('Stripe failed to load');
					return;
				}

				stripe = stripeInstance;

				elements = stripe.elements({
					fonts: [
						{
							cssSrc:
								'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap'
						}
					]
				});

				const baseStyle = {
					base: {
						color: '#161616',
						fontFamily: 'IBM Plex Sans, sans-serif',
						fontSize: '14px',
						fontWeight: '400',
						'::placeholder': {
							color: '#6f6f6f'
						},
						backgroundColor: 'transparent'
					},
					invalid: {
						color: '#161616',
						iconColor: '#161616'
					}
				};

				cardNumberElement = elements.create('cardNumber', { style: baseStyle });
				cardExpiryElement = elements.create('cardExpiry', { style: baseStyle });
				cardCvcElement = elements.create('cardCvc', { style: baseStyle });

				cardNumberElement.mount(cardNumberRef!);
				cardExpiryElement.mount(cardExpiryRef!);
				cardCvcElement.mount(cardCvcRef!);

				// Setup events for all elements
				setupCardNumberEventListeners(cardNumberElement);
				setupCardExpiryEventListeners(cardExpiryElement);
				setupCardCvcEventListeners(cardCvcElement);
			})
			.catch((error) => {
				console.error('Error loading Stripe:', error);
			});
	});

	onDestroy(() => {
		cardNumberElement?.unmount();
		cardExpiryElement?.unmount();
		cardCvcElement?.unmount();
	});

	/**
	 * Payment Confirmation Approaches
	 *
	 * There are two strategies for handling Stripe payment confirmation (Server-side):
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

	async function handleSubmit(event: MouseEvent) {
		event.preventDefault();

		if (!stripe || !elements || !cardNumberElement || !cardExpiryElement || !cardCvcElement) {
			return;
		}

		isPaying = true;

		const { error, paymentMethod } = await stripe.createPaymentMethod({
			type: 'card',
			card: cardNumberElement, // Stripe will automatically validate the card number, expiry, and CVC from the elements instance
			billing_details: {
				name: cardHolderName,
				email: 'johndoe@example.com', // Assume we fetch this from supertokens
				address: {
					state: cardHolderState
				}
			}
		});

		if (error) {
			console.error('Error:', error);
			isPaying = false;
			return;
		}

		const response = await fetch('/api/stripe/payment', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				paymentMethodId: paymentMethod.id,
				email: 'johndoe@example.com',
				profileId: crypto.randomUUID()
			})
		});

		if (!response.ok) {
			isPaying = false;
			isError = true;
			return;
		}

		const { clientSecret } = await response.json();

		const { error: err, paymentIntent } = await stripe.confirmCardPayment(clientSecret);

		if (err) {
			console.error('Error:', err);
			isPaying = false;
			return;
		}

		if (paymentIntent.status === 'succeeded') {
			isSuccess = true;
		}

		cardNumberElement.clear();
		cardExpiryElement.clear();
		cardCvcElement.clear();

		cardHolderName = '';
		cardHolderState = '';

		isPaying = false;
		isSuccess = true;
	}
</script>

<h1 class="mb-8 text-3xl font-bold text-gray-800">Stripe Elements</h1>

<form class="max-w-md">
	<div class="flex flex-col gap-4">
		{#if isPaying || isSuccess || isError}
			<div class="rounded-md bg-green-50 p-4">
				<div class="flex items-center">
					{#if isSuccess}
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					{:else if isError}
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					{/if}
					<div class="ml-3">
						<p class="text-sm font-medium text-green-800">
							{isSuccess && !isError
								? 'Payment successful! Thank you for your purchase.'
								: 'Loading...'}
						</p>
						{#if isError}
							<p class="text-sm text-red-800">
								There was an error processing your payment. Please try again.
							</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}
		<div class="flex w-full flex-col gap-2 text-sm">
			<label for="card-holder-name" class="text-gray-700">Card Holder Name</label>
			<input
				id="card-holder-name"
				type="text"
				bind:value={cardHolderName}
				placeholder="John Doe"
				class="my-2 rounded-md border border-blue-300 bg-white p-4 text-blue-500 shadow-sm outline-none"
			/>

			<label for="card-holder-state" class="text-gray-700">Card Holder State</label>
			<input
				id="card-holder-state"
				type="text"
				bind:value={cardHolderState}
				placeholder="CA"
				class="my-2 rounded-md border border-blue-300 bg-white p-4 text-blue-500 shadow-sm outline-none"
			/>

			<div class="stripe-form">
				<StripeCardField
					bind:ref={cardNumberRef}
					error={errors.cardNumber}
					focused={focusedElement === 'cardNumber'}
					label="Card Number"
					type="cardNumber"
					{cardType}
				/>
				<StripeCardField
					bind:ref={cardExpiryRef}
					error={errors.cardExpiry}
					focused={focusedElement === 'cardExpiry'}
					label="Expiration Date"
					type="cardExpiry"
					{cardType}
				/>
				<StripeCardField
					bind:ref={cardCvcRef}
					error={errors.cardCvc}
					focused={focusedElement === 'cardCvc'}
					label="Security Code"
					type="cvc"
					{cardType}
				/>
			</div>

			<button
				type="submit"
				onclick={handleSubmit}
				class="rounded-md bg-blue-500 px-6 py-2.5 font-medium text-white
					   transition-colors duration-200 hover:bg-blue-600
					   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
					   active:bg-blue-700"
			>
				Pay $1000
			</button>
		</div>
	</div>
</form>

<style lang="scss">
	$stripe-text-color: #161616;
	$stripe-label-color: #525252;
	$stripe-border-color: #8d8d8d;
	$stripe-bg-color: #f4f4f4;
	$stripe-focus-color: #0f62fe;
	$stripe-error-color: #da1e28;

	$stripe-transition: 70ms cubic-bezier(0.2, 0, 0.38, 0.9);
	$stripe-outline-width: 2px;

	.stripe {
		&-form {
			display: grid;
			gap: 1.5rem;
			max-width: 100%;
		}
	}
</style>
