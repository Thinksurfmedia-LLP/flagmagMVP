import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production"
);

const COOKIE_NAME = "flagmag-token";

// Routes that require authentication
const protectedRoutes = [
    "/players",
    "/admin",
];

// Routes that should redirect to home if already authenticated
const authRoutes = ["/login", "/signup"];

// Routes that are always public (no auth check needed)
const publicRoutes = [
    "/",
    "/organizations",
    "/api",
];

function isProtected(pathname) {
    return protectedRoutes.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname) {
    return authRoutes.some((route) => pathname === route);
}

function isPublic(pathname) {
    return publicRoutes.some((route) => pathname.startsWith(route));
}

async function verifyAuth(request) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // Skip middleware for static assets and API routes
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/assets") ||
        pathname.startsWith("/api") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    const user = await verifyAuth(request);

    // Protected routes: redirect to login if not authenticated
    if (isProtected(pathname) && !user) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Auth routes: redirect to home if already authenticated
    if (isAuthRoute(pathname) && user) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    // Add user info to headers for server components (optional)
    const response = NextResponse.next();
    if (user) {
        response.headers.set("x-user-id", user.id);
        response.headers.set("x-user-role", user.role);
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         */
        "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
    ],
};
