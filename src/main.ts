// Compose the scientific application and the post-mount TPP translation layer in one
// bundle so model modules, manifests, deterministic caches, and build identity remain
// singletons. The app module mounts synchronously during dependency evaluation.
import "./app";
import { installTppWorkbench } from "./ui/tpp-workbench";

queueMicrotask(() => installTppWorkbench(document));
