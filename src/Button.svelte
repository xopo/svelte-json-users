<script>
    export let disabled;
</script>

<style>
    button {
        outline: none;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        padding: 5px;
        min-height: 32px;
    }
</style>

<button on:click {disabled}>
    <slot></slot>
</button>