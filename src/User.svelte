<script>
    import Button from './Button.svelte';
    import { users } from  './data-users';
    export let key;
    export let user;
    export let errors;

    let undo = false;
    let double = false;
    let counter = 3;

    let countDown;
    let timeOut;

    const deleteUser = () => {
        undo=true;
        countDown = setInterval(() => {
            counter = counter - 1;
            if (counter <= 0) {
                clearInterval(countDown);
                counter = 3;
            }
        }, 1000);

        timeOut = setTimeout(() => {
            if (undo) {
                delete $users[key];
                $users = $users;
                undo=false;
            }
        }, 3000);
    }
    const undoDeleteUser = () => {
        undo = false;
        counter = 3;
        clearInterval(countDown);
        clearTimeout(timeOut);
    }

    const checkForDouble = () => {
        double = Object.values($users).some(stored => stored.name === user.name && stored.id !== user.id);
        errors = double;
    }
</script>

<!--  ########################################################################################  -->

<style>
    .user {
        display: grid;
        grid-template-columns: 2fr 5fr 2fr;
        grid-gap: 10px;
        padding-left: 5px;
    }
    input {
        width: 100%;
        border: 1px solid gray;
        outline: none;
        padding-left: .5em;
    }

    
    
    .double, .double >input, .double>button {
        color: red;
    }
</style>

<!--  ########################################################################################  -->

<div class="user" class:double>
    <div>{key}</div>
    <input type="text" bind:value={user.name} on:keyup={checkForDouble} autofocus>
    {#if !undo}
        <Button on:click={deleteUser}> 🗑️ Delete</Button>
    {:else}
        <Button on:click={undoDeleteUser}>Undo ({counter})</Button>
    {/if}
</div>