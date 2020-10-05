<script>
    import { users } from  './data-users';
    export let key;
    export let user;
    export let errors;

    let undo = false;
    let double = false;

    const deleteUser = () => {
        undo=true;
        setTimeout(() => {
            if (undo) {
                delete $users[key];
                $users = $users;
                undo=false;
            }
        }, 3000);
    }
    const undoDeleteUser = () => {
        undo = false;
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
    }

    button {
        outline: none;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        padding: 5px;
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
        <button on:click={deleteUser}> 🗑️ Delete</button>
    {:else}
        <button on:click={undoDeleteUser}>Undo</button>
    {/if}
</div>