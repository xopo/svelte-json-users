<script>
    import Button from './Button.svelte';
    import { users, removeUser } from  './data-users';
    export let key;
    export let user;
    export let errors;
    export let wip;

    let undo = false;
    let double = false;
    let counter = 3;

    let countDown;
    let timeOut;

    $: blocked = wip.length && !wip.includes(key);

    const deleteUser = () => {
        if (wip.includes(key)) return false;

        wip = [...wip, key];
        console.log('delete user', key, {...user});
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
                removeUser(key)
                clearWaiting();
            }
        }, 3000);
    }

    const clearWaiting = () => {
        wip = wip.filter(el => el!==key)
        undo = false;
        counter = 3;
    }

    const undoDeleteUser = () => {
        clearInterval(countDown);
        clearTimeout(timeOut);
        clearWaiting();
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
    <input disabled={blocked} type="text" bind:value={user.name} on:keyup={checkForDouble} autofocus>
    {#if !undo}
        <Button on:click={deleteUser} disabled={blocked}> 🗑️ Delete</Button>
    {:else}
        <Button on:click={undoDeleteUser} disabled={blocked}>Undo ({counter})</Button>
    {/if}
</div>