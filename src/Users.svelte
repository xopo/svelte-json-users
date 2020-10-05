<script>
    import { users } from './data-users';
    import User from './User.svelte';
    import Button from './Button.svelte';
    
    let errors = false;
    let wip = [];
    
    $:emptyNames = Object.values($users).some(user => !user.name.trim().length);
    
    const addUser = () => {
        const id = Math.round(Math.random() * 1000);
        let name='';
        $users[`ID${id}`] = {id, name};
    }    

    

</script>

<!--  ########################################################################################  -->

<style>
    #users {
        display: grid;
        grid-gap: 10px;
        padding: 10px;
    }
</style>

<!--  ########################################################################################  -->

<div id="users">
    {#each Object.keys($users) as key}
        <User {key} bind:user={$users[key]} bind:errors bind:wip />
    {/each}
    <Button on:click={addUser} disabled={errors || emptyNames}>Add user</Button>
    {#if Object.keys($users).length}
        <pre>
            {JSON.stringify([$users, errors, wip], null, 2)}
        </pre>
    {:else}
        <p>Add some users in order to play with this magnificent form</p>
    {/if}
</div>