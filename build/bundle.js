var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    let users = writable({
        "ID111": { "id": 111, "name": "A" },
        "ID222": { "id": 222, "name": "B" },
        "ID333": { "id": 333, "name": "C" }
    });

    const removeUser = (id) => {
        if (id) {
            users.update( items => {
                delete items[id];
                return items;
            });
            
        }
    };

    /* src/Button.svelte generated by Svelte v3.29.0 */

    function create_fragment(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	return {
    		c() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			button.disabled = /*disabled*/ ctx[0];
    			attr(button, "class", "svelte-84h5zz");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*disabled*/ 1) {
    				button.disabled = /*disabled*/ ctx[0];
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { disabled } = $$props;

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ("disabled" in $$props) $$invalidate(0, disabled = $$props.disabled);
    		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	return [disabled, $$scope, slots, click_handler];
    }

    class Button extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { disabled: 0 });
    	}
    }

    /* src/User.svelte generated by Svelte v3.29.0 */

    function create_else_block(ctx) {
    	let button;
    	let current;

    	button = new Button({
    			props: {
    				disabled: /*blocked*/ ctx[5],
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*undoDeleteUser*/ ctx[7]);

    	return {
    		c() {
    			create_component(button.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const button_changes = {};
    			if (dirty & /*blocked*/ 32) button_changes.disabled = /*blocked*/ ctx[5];

    			if (dirty & /*$$scope, counter*/ 65552) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(button, detaching);
    		}
    	};
    }

    // (86:4) {#if !undo}
    function create_if_block(ctx) {
    	let button;
    	let current;

    	button = new Button({
    			props: {
    				disabled: /*blocked*/ ctx[5],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*deleteUser*/ ctx[6]);

    	return {
    		c() {
    			create_component(button.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(button, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const button_changes = {};
    			if (dirty & /*blocked*/ 32) button_changes.disabled = /*blocked*/ ctx[5];

    			if (dirty & /*$$scope*/ 65536) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(button, detaching);
    		}
    	};
    }

    // (89:8) <Button on:click={undoDeleteUser} disabled={blocked}>
    function create_default_slot_1(ctx) {
    	let t0;
    	let t1;
    	let t2;

    	return {
    		c() {
    			t0 = text("Undo (");
    			t1 = text(/*counter*/ ctx[4]);
    			t2 = text(")");
    		},
    		m(target, anchor) {
    			insert(target, t0, anchor);
    			insert(target, t1, anchor);
    			insert(target, t2, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*counter*/ 16) set_data(t1, /*counter*/ ctx[4]);
    		},
    		d(detaching) {
    			if (detaching) detach(t0);
    			if (detaching) detach(t1);
    			if (detaching) detach(t2);
    		}
    	};
    }

    // (87:8) <Button on:click={deleteUser} disabled={blocked}>
    function create_default_slot(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("🗑️ Delete");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let t1;
    	let input;
    	let t2;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*undo*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(/*key*/ ctx[1]);
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			if_block.c();
    			input.disabled = /*blocked*/ ctx[5];
    			attr(input, "type", "text");
    			input.autofocus = true;
    			attr(input, "class", "svelte-1f7vp5h");
    			attr(div1, "class", "user svelte-1f7vp5h");
    			toggle_class(div1, "double", /*double*/ ctx[3]);
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, t0);
    			append(div1, t1);
    			append(div1, input);
    			set_input_value(input, /*user*/ ctx[0].name);
    			append(div1, t2);
    			if_blocks[current_block_type_index].m(div1, null);
    			current = true;
    			input.focus();

    			if (!mounted) {
    				dispose = [
    					listen(input, "input", /*input_input_handler*/ ctx[11]),
    					listen(input, "keyup", /*checkForDouble*/ ctx[8])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*key*/ 2) set_data(t0, /*key*/ ctx[1]);

    			if (!current || dirty & /*blocked*/ 32) {
    				input.disabled = /*blocked*/ ctx[5];
    			}

    			if (dirty & /*user*/ 1 && input.value !== /*user*/ ctx[0].name) {
    				set_input_value(input, /*user*/ ctx[0].name);
    			}

    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(div1, null);
    			}

    			if (dirty & /*double*/ 8) {
    				toggle_class(div1, "double", /*double*/ ctx[3]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $users;
    	component_subscribe($$self, users, $$value => $$invalidate(14, $users = $$value));
    	let { key } = $$props;
    	let { user } = $$props;
    	let { errors } = $$props;
    	let { wip } = $$props;
    	let undo = false;
    	let double = false;
    	let counter = 3;
    	let countDown;
    	let timeOut;

    	const deleteUser = () => {
    		if (wip.includes(key)) return false;
    		$$invalidate(10, wip = [...wip, key]);
    		console.log("delete user", key, { ...user });
    		$$invalidate(2, undo = true);

    		countDown = setInterval(
    			() => {
    				$$invalidate(4, counter = counter - 1);

    				if (counter <= 0) {
    					clearInterval(countDown);
    					$$invalidate(4, counter = 3);
    				}
    			},
    			1000
    		);

    		timeOut = setTimeout(
    			() => {
    				if (undo) {
    					removeUser(key);
    					clearWaiting();
    				}
    			},
    			3000
    		);
    	};

    	const clearWaiting = () => {
    		$$invalidate(10, wip = wip.filter(el => el !== key));
    		$$invalidate(2, undo = false);
    		$$invalidate(4, counter = 3);
    	};

    	const undoDeleteUser = () => {
    		clearInterval(countDown);
    		clearTimeout(timeOut);
    		clearWaiting();
    	};

    	const checkForDouble = () => {
    		$$invalidate(3, double = Object.values($users).some(stored => stored.name === user.name && stored.id !== user.id));
    		$$invalidate(9, errors = double);
    	};

    	function input_input_handler() {
    		user.name = this.value;
    		$$invalidate(0, user);
    	}

    	$$self.$$set = $$props => {
    		if ("key" in $$props) $$invalidate(1, key = $$props.key);
    		if ("user" in $$props) $$invalidate(0, user = $$props.user);
    		if ("errors" in $$props) $$invalidate(9, errors = $$props.errors);
    		if ("wip" in $$props) $$invalidate(10, wip = $$props.wip);
    	};

    	let blocked;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*wip, key*/ 1026) {
    			 $$invalidate(5, blocked = wip.length && !wip.includes(key));
    		}
    	};

    	return [
    		user,
    		key,
    		undo,
    		double,
    		counter,
    		blocked,
    		deleteUser,
    		undoDeleteUser,
    		checkForDouble,
    		errors,
    		wip,
    		input_input_handler
    	];
    }

    class User extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { key: 1, user: 0, errors: 9, wip: 10 });
    	}
    }

    /* src/Users.svelte generated by Svelte v3.29.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[9] = list;
    	child_ctx[10] = i;
    	return child_ctx;
    }

    // (34:4) {#each Object.keys($users) as key}
    function create_each_block(ctx) {
    	let user;
    	let updating_user;
    	let updating_errors;
    	let updating_wip;
    	let current;

    	function user_user_binding(value) {
    		/*user_user_binding*/ ctx[5].call(null, value, /*key*/ ctx[8]);
    	}

    	function user_errors_binding(value) {
    		/*user_errors_binding*/ ctx[6].call(null, value);
    	}

    	function user_wip_binding(value) {
    		/*user_wip_binding*/ ctx[7].call(null, value);
    	}

    	let user_props = { key: /*key*/ ctx[8] };

    	if (/*$users*/ ctx[3][/*key*/ ctx[8]] !== void 0) {
    		user_props.user = /*$users*/ ctx[3][/*key*/ ctx[8]];
    	}

    	if (/*errors*/ ctx[0] !== void 0) {
    		user_props.errors = /*errors*/ ctx[0];
    	}

    	if (/*wip*/ ctx[1] !== void 0) {
    		user_props.wip = /*wip*/ ctx[1];
    	}

    	user = new User({ props: user_props });
    	binding_callbacks.push(() => bind(user, "user", user_user_binding));
    	binding_callbacks.push(() => bind(user, "errors", user_errors_binding));
    	binding_callbacks.push(() => bind(user, "wip", user_wip_binding));

    	return {
    		c() {
    			create_component(user.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(user, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const user_changes = {};
    			if (dirty & /*$users*/ 8) user_changes.key = /*key*/ ctx[8];

    			if (!updating_user && dirty & /*$users, Object*/ 8) {
    				updating_user = true;
    				user_changes.user = /*$users*/ ctx[3][/*key*/ ctx[8]];
    				add_flush_callback(() => updating_user = false);
    			}

    			if (!updating_errors && dirty & /*errors*/ 1) {
    				updating_errors = true;
    				user_changes.errors = /*errors*/ ctx[0];
    				add_flush_callback(() => updating_errors = false);
    			}

    			if (!updating_wip && dirty & /*wip*/ 2) {
    				updating_wip = true;
    				user_changes.wip = /*wip*/ ctx[1];
    				add_flush_callback(() => updating_wip = false);
    			}

    			user.$set(user_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(user.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(user.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(user, detaching);
    		}
    	};
    }

    // (37:4) <Button on:click={addUser} disabled={errors || emptyNames}>
    function create_default_slot$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Add user");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (42:4) {:else}
    function create_else_block$1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.textContent = "Add some users in order to play with this magnificent form";
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (38:4) {#if Object.keys($users).length}
    function create_if_block$1(ctx) {
    	let pre;
    	let t_value = JSON.stringify([/*$users*/ ctx[3], /*errors*/ ctx[0], /*wip*/ ctx[1]], null, 2) + "";
    	let t;

    	return {
    		c() {
    			pre = element("pre");
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, pre, anchor);
    			append(pre, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$users, errors, wip*/ 11 && t_value !== (t_value = JSON.stringify([/*$users*/ ctx[3], /*errors*/ ctx[0], /*wip*/ ctx[1]], null, 2) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(pre);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t0;
    	let button;
    	let t1;
    	let show_if;
    	let current;
    	let each_value = Object.keys(/*$users*/ ctx[3]);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	button = new Button({
    			props: {
    				disabled: /*errors*/ ctx[0] || /*emptyNames*/ ctx[2],
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*addUser*/ ctx[4]);

    	function select_block_type(ctx, dirty) {
    		if (show_if == null || dirty & /*$users*/ 8) show_if = !!Object.keys(/*$users*/ ctx[3]).length;
    		if (show_if) return create_if_block$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			create_component(button.$$.fragment);
    			t1 = space();
    			if_block.c();
    			attr(div, "id", "users");
    			attr(div, "class", "svelte-1aeodi1");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t0);
    			mount_component(button, div, null);
    			append(div, t1);
    			if_block.m(div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*Object, $users, errors, wip*/ 11) {
    				each_value = Object.keys(/*$users*/ ctx[3]);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, t0);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			const button_changes = {};
    			if (dirty & /*errors, emptyNames*/ 5) button_changes.disabled = /*errors*/ ctx[0] || /*emptyNames*/ ctx[2];

    			if (dirty & /*$$scope*/ 2048) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx, dirty)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			destroy_component(button);
    			if_block.d();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $users;
    	component_subscribe($$self, users, $$value => $$invalidate(3, $users = $$value));
    	let errors = false;
    	let wip = [];

    	const addUser = () => {
    		const id = Math.round(Math.random() * 1000);
    		let name = "";
    		set_store_value(users, $users[`ID${id}`] = { id, name }, $users);
    	};

    	function user_user_binding(value, key) {
    		$users[key] = value;
    		users.set($users);
    	}

    	function user_errors_binding(value) {
    		errors = value;
    		$$invalidate(0, errors);
    	}

    	function user_wip_binding(value) {
    		wip = value;
    		$$invalidate(1, wip);
    	}

    	let emptyNames;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$users*/ 8) {
    			 $$invalidate(2, emptyNames = Object.values($users).some(user => !user.name.trim().length));
    		}
    	};

    	return [
    		errors,
    		wip,
    		emptyNames,
    		$users,
    		addUser,
    		user_user_binding,
    		user_errors_binding,
    		user_wip_binding
    	];
    }

    class Users extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.0 */

    function create_fragment$3(ctx) {
    	let t;
    	let main;
    	let div;
    	let users;
    	let current;
    	users = new Users({});

    	return {
    		c() {
    			t = space();
    			main = element("main");
    			div = element("div");
    			create_component(users.$$.fragment);
    			document.title = "Simple Svelte Form";
    			attr(div, "id", "users");
    			attr(main, "class", "svelte-d5t4w6");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    			insert(target, main, anchor);
    			append(main, div);
    			mount_component(users, div, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(users.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(users.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    			if (detaching) detach(main);
    			destroy_component(users);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
