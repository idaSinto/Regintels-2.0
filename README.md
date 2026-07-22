This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## SharePoint Setup

The Product Impact Explorer reads product rows live from SharePoint through Microsoft Graph. It does not store product's metadata in Supabase.

Create these environment variables in `.env.local`:

```bash
MS_TENANT_ID=
MS_CLIENT_ID=
MS_CLIENT_SECRET=
MS_SHAREPOINT_SITE_ID=
MS_SHAREPOINT_LIST_PRODUCTS_ID=
```

### Where to get each value

1. `MS_TENANT_ID`
   - Open the Microsoft Entra admin center.
   - Go to **Microsoft Entra ID**.
   - Copy the **Tenant ID** from the overview page.
   - Microsoft Graph app-only auth uses this tenant value for the token request [[1]](https://learn.microsoft.com/en-us/graph/auth-v2-service).

2. `MS_CLIENT_ID`
   - Register an app in Microsoft Entra ID.
   - Copy the app's **Application (client) ID** from the app registration overview.
   - Microsoft documents this as the value used by client-credentials auth [[2]](https://learn.microsoft.com/en-us/graph/auth-register-app-v2).

3. `MS_CLIENT_SECRET`
   - In the same app registration, open **Certificates & secrets**.
   - Create a **New client secret**.
   - Copy the secret value immediately after creation; Microsoft only shows it once [[2]](https://learn.microsoft.com/en-us/graph/auth-register-app-v2).

4. `MS_SHAREPOINT_SITE_ID`
   - Get the site by path with Microsoft Graph, or use Graph Explorer / a direct Graph call.
   - The returned JSON contains the SharePoint site `id` in the form `hostname,guid,guid` [[3]](https://learn.microsoft.com/en-us/graph/api/site-getbypath?view=graph-rest-1.0).

5. `MS_SHAREPOINT_LIST_PRODUCTS_ID`
   - Call Microsoft Graph on the site to list the SharePoint lists.
   - Find the list your product data lives in and copy its `id` [[4]](https://learn.microsoft.com/en-us/graph/api/list-list?view=graph-rest-1.0) [[5]](https://learn.microsoft.com/en-us/graph/api/list-get?view=graph-rest-1.0).

### Practical fetch order

1. Create the Entra app registration.
2. Grant Microsoft Graph application permissions for SharePoint access and admin consent.
3. Copy `MS_TENANT_ID`, `MS_CLIENT_ID`, and `MS_CLIENT_SECRET`.
4. Use Graph to resolve `MS_SHAREPOINT_SITE_ID`.
5. Use Graph to resolve `MS_SHAREPOINT_LIST_PRODUCTS_ID`.
6. Put the values in `.env.local`.
7. Restart the dev server.

If any of the Microsoft variables are missing, the page will now show the missing names instead of silently failing.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
