import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Mounts the routes Convex Auth needs (token exchange, callbacks).
auth.addHttpRoutes(http);

export default http;
