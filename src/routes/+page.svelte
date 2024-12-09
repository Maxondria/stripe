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

	let stripe: Stripe | null = $state(null);
	let elements: StripeElements | null = $state(null);

	let cardNumberElement: StripeCardNumberElement | null = $state(null);
	let cardExpiryElement: StripeCardExpiryElement | null = $state(null);
	let cardCvcElement: StripeCardCvcElement | null = $state(null);

	let cardNumberRef: HTMLDivElement;
	let cardExpiryRef: HTMLDivElement;
	let cardCvcRef: HTMLDivElement;

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

				cardNumberElement.mount(cardNumberRef);
				cardExpiryElement.mount(cardExpiryRef);
				cardCvcElement.mount(cardCvcRef);

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
			unionpay: '/images/unionpay.png',
			unknown: '/images/unknown.png'
		} as const;

		const cardNumberElement = document.querySelector('.stripe-element-card-number');

		if (cardNumberElement) {
			const imageUrl = cardImages[cardType] || cardImages.unknown;
			(cardNumberElement as HTMLElement).style.backgroundImage = `url(${imageUrl})`;
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
				<div class="stripe-input-wrapper">
					<label class="stripe-label" for="card-number">Card Number</label>
					<div
						id="card-number"
						class="stripe-input-container"
						class:error={errors.cardNumber}
						class:focused={focusedElement === 'cardNumber'}
					>
						<div bind:this={cardNumberRef} class="stripe-element stripe-element-card-number"></div>
						{#if errors.cardNumber}
							<div class="stripe-error-icon">
								<svg
									focusable="false"
									preserveAspectRatio="xMidYMid meet"
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
									width="16"
									height="16"
									viewBox="0 0 16 16"
									aria-hidden="true"
								>
									<path
										d="M8,1C4.2,1,1,4.2,1,8s3.2,7,7,7s7-3.1,7-7S11.9,1,8,1z M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2	c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
									></path>
									<path
										d="M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8	c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
										data-icon-path="inner-path"
										opacity="0"
									></path>
								</svg>
							</div>
						{/if}
					</div>
					{#if errors.cardNumber}
						<div class="stripe-form-requirement">{errors.cardNumber}</div>
					{/if}
				</div>

				<div class="stripe-input-wrapper">
					<label class="stripe-label" for="card-expiry">Expiry Date</label>
					<div
						id="card-expiry"
						class="stripe-input-container"
						class:error={errors.cardExpiry}
						class:focused={focusedElement === 'cardExpiry'}
					>
						<div bind:this={cardExpiryRef} class="stripe-element stripe-element-expiry"></div>
						{#if errors.cardExpiry}
							<div class="stripe-error-icon">
								<svg
									focusable="false"
									preserveAspectRatio="xMidYMid meet"
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
									width="16"
									height="16"
									viewBox="0 0 16 16"
									aria-hidden="true"
								>
									<path
										d="M8,1C4.2,1,1,4.2,1,8s3.2,7,7,7s7-3.1,7-7S11.9,1,8,1z M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2	c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
									></path>
									<path
										d="M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8	c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
										data-icon-path="inner-path"
										opacity="0"
									></path>
								</svg>
							</div>
						{/if}
					</div>
					{#if errors.cardExpiry}
						<div class="stripe-form-requirement">{errors.cardExpiry}</div>
					{/if}
				</div>

				<div class="stripe-input-wrapper">
					<label class="stripe-label" for="card-cvc">Security Code</label>
					<div
						id="card-cvc"
						class="stripe-input-container"
						class:error={errors.cardCvc}
						class:focused={focusedElement === 'cardCvc'}
					>
						<div bind:this={cardCvcRef} class="stripe-element stripe-element-cvc"></div>
						{#if errors.cardCvc}
							<div class="stripe-error-icon">
								<svg
									focusable="false"
									preserveAspectRatio="xMidYMid meet"
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
									width="16"
									height="16"
									viewBox="0 0 16 16"
									aria-hidden="true"
								>
									<path
										d="M8,1C4.2,1,1,4.2,1,8s3.2,7,7,7s7-3.1,7-7S11.9,1,8,1z M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2	c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
									></path>
									<path
										d="M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8	c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
										data-icon-path="inner-path"
										opacity="0"
									></path>
								</svg>
							</div>
						{/if}
					</div>
					{#if errors.cardCvc}
						<div class="stripe-form-requirement">{errors.cardCvc}</div>
					{/if}
				</div>
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

		&-input-wrapper {
			margin-bottom: 0;
		}

		&-label {
			color: $stripe-label-color;
			font: {
				size: 0.75rem;
				weight: 400;
			}
			letter-spacing: 0.32px;
			line-height: 1.34;
			margin-bottom: 0.5rem;
			display: inline-block;
		}

		&-input-container {
			position: relative;
			width: 100%;
			min-height: 2.5rem;
			background-color: $stripe-bg-color;
			border: none;
			border-bottom: 1px solid $stripe-border-color;
			transition:
				background-color $stripe-transition,
				outline $stripe-transition;

			&.focused:not(.error) {
				outline: $stripe-outline-width solid $stripe-focus-color;
				outline-offset: -$stripe-outline-width;
			}

			&.error {
				outline: $stripe-outline-width solid $stripe-error-color;
				outline-offset: -$stripe-outline-width;
				border-bottom-color: $stripe-error-color;

				&.focused {
					outline: $stripe-outline-width solid $stripe-error-color;
					outline-offset: -$stripe-outline-width;
				}

				.stripe-error-icon {
					position: absolute;
					right: 0.5rem;
					top: 50%;
					transform: translateY(-50%);
					color: $stripe-error-color;
					display: flex;
					align-items: center;
					justify-content: center;
					pointer-events: none;
				}
			}

			&.error .stripe-element-card-number {
				background-position: right 0.8rem center;
			}
		}

		&-element {
			width: 100%;
			padding: 0 1rem;
			position: absolute;
			top: 50%;
			transform: translateY(-50%);

			&-card-number {
				background: {
					repeat: no-repeat;
					position: right -0.8rem center;
					size: 1.7rem;
					origin: content-box;
				}
			}

			&-cvc {
				background: {
					repeat: no-repeat;
					position: right -0.8rem center;
					size: 1.7rem;
					origin: content-box;
					image: url('/images/cvc.png');
				}
			}
		}
	}

	.stripe-form-requirement {
		margin-top: 0.25rem;
		font: {
			size: 0.75rem;
			weight: 400;
		}
		line-height: 1.34;
		color: $stripe-error-color;
	}
</style>
