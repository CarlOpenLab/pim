import { createApp } from "vue";
import "antdv-next/dist/reset.css";
import Antdv from "antdv-next";
import App from "./App.vue";
import "./style.css";

const app = createApp(App);
app.use(Antdv);
app.mount("#app");
