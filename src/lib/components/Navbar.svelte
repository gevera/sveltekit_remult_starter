<script lang="ts">
	import { enhance } from '$app/forms';
	import { route } from '$lib/ROUTES';
	import type { User } from 'better-auth';

	let { user }: { user: User | null } = $props();
</script>

<nav>
	<div>
		<a href={route('/')}>Home</a>
		{#if user}
			<span>Logged in as: {user.email}</span>
			<form method="POST" action="/?/logout" use:enhance>
				<button type="submit">Logout</button>
			</form>
		{:else}
			<a href={route('/auth/login')}>Login</a>
			<a href={route('/auth/register')}>Register</a>
		{/if}
	</div>
</nav>
