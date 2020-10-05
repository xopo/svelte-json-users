<script>
	import Users from './Users.svelte';
	import { users } from './data-users.js';
	 
</script>

<main>
	<div id="users">
		<Users />
		
	</div>
</main>

<style>
	main {
		max-width: 840px;
		margin: 0 auto;
	}
</style>