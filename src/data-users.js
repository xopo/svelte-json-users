import { writable } from 'svelte/store';

export let users = writable({
    "ID111": { "id": 111, "name": "A" },
    "ID222": { "id": 222, "name": "B" },
    "ID333": { "id": 333, "name": "C" }
});

export const removeUser = (id) => {
    if (id) {
        users.update( items => {
            delete items[id];
            return items;
        })
        
    }
}