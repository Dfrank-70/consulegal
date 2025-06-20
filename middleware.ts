import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that are always accessible
  const publicPaths = [
    '/login',
    '/register',
    '/',
    '/test',             // Existing test page
    '/diagnose',
    '/test-simple',
    '/css-test',
    '/test-tailwind',    // Added test page
    '/tailwind-fix-test',// Added test page
    '/minimal-test',     // Added test page
    '/direct-css-test',  // Added test page
    '/final-test',       // Added test page
    '/pricing'           // Make pricing page public
  ];

  // Check if the current path is public
  // Adjusted to correctly handle the root path '/' and other prefixed paths
  const isPublicPath = publicPaths.some((path) =>
    pathname === path || (path !== '/' && pathname.startsWith(path) && (pathname[path.length] === '/' || pathname.length === path.length))
  );

  // Check if the user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Redirect authenticated users from login/register to dashboard
  // Redirect authenticated users from login, register, or the root page to the dashboard
  if (token && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login for protected pages
  if (!token && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the original requested URL (including query params) as callbackUrl
    loginUrl.searchParams.set('callbackUrl', encodeURI(request.url.toString())); // Use request.url.toString()
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Matcher to define on which paths the middleware should run
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (if you have a public/images folder)
     * - manifest.json, sw.js, robots.txt, sitemap.xml (common public files)
     * This ensures the middleware doesn't interfere with static assets or API calls.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|manifest.json|sw.js|robots.txt|sitemap.xml).*)',
  ],
};
