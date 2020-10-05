<script>
    import { users } from './data-users';
    import User from './User.svelte';
    
    let errors = false;
    
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

    button {
        outline: none;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        padding: 15px;
        border: 1px solid gray;
    }

</style>

<!--  ########################################################################################  -->

<div id="users">
    {#each Object.keys($users) as key}
        <User {key} bind:user={$users[key]} bind:errors/>
    {/each}
    <button on:click={addUser} disabled={errors}>Add user</button>
    <pre>
        {JSON.stringify([$users, errors], null, 2)}
    </pre>
</div>