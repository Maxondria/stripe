<script lang="ts">
	import {
		loadStripe,
		type Stripe,
		type StripeCardCvcElement,
		type StripeCardExpiryElement,
		// type StripeCardElement,
		type StripeCardNumberElement,
		type StripeElements
	} from '@stripe/stripe-js';
	import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';

	let stripe: Stripe | null = $state(null);
	let elements: StripeElements | null = $state(null);

	let cardNumberElement: StripeCardNumberElement | null = $state(null);
	let cardExpiryElement: StripeCardExpiryElement | null = $state(null);
	let cardCvcElement: StripeCardCvcElement | null = $state(null);

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

	$effect(() => {
		loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY)
			.then((stripeInstance) => {
				if (!stripeInstance) {
					console.error('Stripe failed to load');
					return;
				}

				stripe = stripeInstance;
				/**
				 * Custom font configuration for Stripe Elements
				 *
				 * To use Montserrat font family in the card element:
				 * 1. Uncomment and replace the default elements initialization:
				 *    elements = stripe.elements({
				 *        fonts: [
				 *            {
				 *                cssSrc: 'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap'
				 *            }
				 *        ]
				 *    });
				 *
				 * 2. Update the card element's style object fontFamily to:
				 *    fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
				 */

				elements = stripe.elements();

				const baseStyle = {
					base: {
						color: 'blue',
						fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
						fontSize: '16px',
						'::placeholder': {
							color: '#a0aec0'
						}
					},
					invalid: {
						color: '#ef4444',
						iconColor: '#ef4444'
					}
				};

				cardNumberElement = elements.create('cardNumber', { style: baseStyle });
				cardExpiryElement = elements.create('cardExpiry', { style: baseStyle });
				cardCvcElement = elements.create('cardCvc', { style: baseStyle });

				/**
				 * Mount the elements and set the errors
				 */

				cardNumberElement.mount('#card-number-element');
				cardExpiryElement.mount('#card-expiry-element');
				cardCvcElement.mount('#card-cvc-element');

				cardNumberElement.on('change', (event) => {
					cardType = event.brand;
					errors.cardNumber = event.error?.message ?? null;
				});

				cardExpiryElement.on('change', (event) => {
					errors.cardExpiry = event.error?.message ?? null;
				});

				cardCvcElement.on('change', (event) => {
					errors.cardCvc = event.error?.message ?? null;
				});
			})
			.catch((error) => {
				console.error('Error loading Stripe:', error);
			});

		return () => {
			cardNumberElement?.unmount();
		};
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
				profileId: crypto.randomUUID()
			})
		});

		if (!response.ok) {
			isPaying = false;
			isError = true;
			return;
		}

		const data = await response.json();

		console.log(data);

		cardNumberElement.clear();
		cardExpiryElement.clear();
		cardCvcElement.clear();

		cardHolderName = '';
		cardHolderState = '';

		isPaying = false;
		isSuccess = true;
	}

	$effect(() => {
		const cardImages = {
			visa: '/images/visa.png',
			mastercard: '/images/mastercard.png',
			amex: '/images/amex.png',
			discover: '/images/discover.png',
			diners: '/images/diners.png',
			jcb: '/images/jcb.png',
			unknown: '/images/unknown.png'
		} as const;
		/**
		 * We should be able to use the ref to set the background image
		 */
		const cardElement = document.getElementById('card-number-element');

		if (cardElement) {
			const imageUrl = cardImages[cardType as keyof typeof cardImages] || cardImages.unknown;
			cardElement.style.backgroundImage = `url(${imageUrl})`;
		}
	});
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
			<!-- <label for="card-element" class="text-gray-700">Credit or debit card</label>
			<div
				id="card-element"
				class="my-2 rounded-md border border-blue-300 bg-white p-4 text-blue-500 shadow-sm outline-none"
			></div> -->
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

			<label for="card-number-element" class="text-gray-700">Card Number</label>
			<div
				id="card-number-element"
				class="my-2 rounded-md border border-blue-300 bg-white p-4 text-blue-500 shadow-sm outline-none"
			></div>

			<label for="card-expiry-element" class="text-gray-700">Expiry Date</label>
			<div
				id="card-expiry-element"
				class="my-2 rounded-md border border-blue-300 bg-white p-4 text-blue-500 shadow-sm outline-none"
			></div>

			<label for="card-cvc-element" class="text-gray-700">CVC</label>
			<div
				id="card-cvc-element"
				class="my-2 rounded-md border border-blue-300 bg-white p-4 text-blue-500 shadow-sm outline-none"
			></div>
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
</form>

<style>
	#card-number-element {
		background-image: url('/images/cvc.png');
		background-repeat: no-repeat;
		background-position: right center;
		background-size: 30px;
		background-origin: content-box;
	}

	#card-cvc-element {
		background-image: url('/images/cvc.png');
		background-repeat: no-repeat;
		background-position: right center;
		background-size: 30px;
		background-origin: content-box;
	}
</style>
