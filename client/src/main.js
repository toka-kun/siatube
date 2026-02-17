import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

if (typeof console !== 'undefined') {
	['log', 'warn', 'error', 'info', 'debug'].forEach((m) => {
		try {
			console[m] = () => {};
		} catch (e) {}
	});
}

createApp(App).use(router).mount("#app");
