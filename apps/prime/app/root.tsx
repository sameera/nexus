import type { ReactElement, ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

export function Layout({ children }: { children: ReactNode }): ReactElement {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>Prime</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" type="image/x-icon" href="/favicon.ico" />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function Root(): ReactElement {
    return <Outlet />;
}
