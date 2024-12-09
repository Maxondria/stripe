<script lang="ts">
	type ElementType = 'cardNumber' | 'cvc' | 'cardExpiry';

	type Props = {
		ref: HTMLDivElement | null;
		error: string | null;
		focused: boolean;
		label: string;
		type: ElementType;
		cardType:
			| 'visa'
			| 'mastercard'
			| 'amex'
			| 'discover'
			| 'diners'
			| 'jcb'
			| 'unknown'
			| 'unionpay';
	};

	let {
		ref = $bindable(),
		error = null,
		focused = false,
		label = '',
		type = 'cardNumber',
		cardType = 'unknown'
	}: Props = $props();

	$effect(() => {
		if (type === 'cardNumber' && ref) {
			const cardImages = new Map([
				['visa', '/images/visa.png'],
				['mastercard', '/images/mastercard.png'],
				['amex', '/images/amex.png'],
				['discover', '/images/discover.png'],
				['diners', '/images/diners.png'],
				['jcb', '/images/jcb.png'],
				['unionpay', '/images/unionpay.png'],
				['unknown', '/images/unknown.png']
			]);

			const cardImagePath = cardImages.get(cardType) || cardImages.get('unknown');
			ref.style.backgroundImage = `url(${cardImagePath})`;
		}
	});
</script>

<div class="stripe-input-wrapper">
	<label class="stripe-label" for={type}>{label}</label>
	<div id={type} class="stripe-input-container" class:error class:focused>
		<div bind:this={ref} class={`stripe-element stripe-element-${type}`}></div>
		{#if error}
			<div class="stripe-error-icon">
				{@render errorSvg()}
			</div>
		{/if}
	</div>
	{#if error}
		<div class="stripe-form-requirement">{error}</div>
	{/if}
</div>

{#snippet errorSvg()}
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
		/>
		<path
			d="M7.5,4h1v5h-1C7.5,9,7.5,4,7.5,4z M8,12.2c-0.4,0-0.8-0.4-0.8-0.8s0.3-0.8,0.8-0.8	c0.4,0,0.8,0.4,0.8,0.8S8.4,12.2,8,12.2z"
			data-icon-path="inner-path"
			opacity="0"
		/>
	</svg>
{/snippet}

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

			&.error .stripe-element-cardNumber {
				background-position: right 1rem center;
			}
		}

		&-element {
			width: 100%;
			padding: 0 1rem;
			position: absolute;
			top: 50%;
			transform: translateY(-50%);

			&-cardNumber {
				background: {
					repeat: no-repeat;
					position: right -0.5rem center;
					size: 1.7rem;
					origin: content-box;
				}
			}

			&-cvc {
				background: {
					repeat: no-repeat;
					position: right -0.5rem center;
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
