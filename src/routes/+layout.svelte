<script lang="ts">
	import '../app.css';
	import '../theme/_carbon.theme.scss';
	let { children } = $props();
</script>

<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
	{@render children()}
</main>
