/* eslint-disable react-refresh/only-export-components -- route configuration module, not a component file */
import { lazy, Suspense } from 'react'
import { FullPageSpinner, RequireAuth } from '../features/auth/Guards'
import { ADMIN_ROLES, SELLER_ROLES } from '../lib/constants'
import HomePage from '../pages/HomePage'
import { BareLayout, PublicLayout, RouteError } from './layouts'

// Route-level code splitting: each area is its own chunk.
const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))
const CarsPage = lazy(() => import('../pages/CarsPage'))
const VehicleDetailPage = lazy(() => import('../pages/VehicleDetailPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const SellLandingPage = lazy(() => import('../pages/sell/SellLandingPage'))
const SellVehiclePage = lazy(() => import('../pages/sell/SellVehiclePage'))
const dealers = () => import('../pages/DealerPages')
const DealersPage = named(dealers, 'DealersPage')
const DealerPage = named(dealers, 'DealerPage')
const content = () => import('../pages/ContentPages')
const CmsPage = named(content, 'CmsPage')
const ContactPage = named(content, 'ContactPage')
const SitemapPage = named(content, 'SitemapPage')
const auth = () => import('../pages/auth/AuthPages')
const LoginPage = named(auth, 'LoginPage')
const RegisterPage = named(auth, 'RegisterPage')
const ForgotPasswordPage = named(auth, 'ForgotPasswordPage')
const ResetPasswordPage = named(auth, 'ResetPasswordPage')
const account = () => import('../pages/account/AccountPages')
const SavedPage = named(account, 'SavedPage')
const MessagesPage = named(account, 'MessagesPage')
const AccountPage = named(account, 'AccountPage')
const dash = () => import('../pages/dashboard/DashboardPages')
const DashboardLayout = named(dash, 'DashboardLayout')
const DashboardHome = named(dash, 'DashboardHome')
const MyListingsPage = named(dash, 'MyListingsPage')
const DashboardMessagesPage = named(dash, 'DashboardMessagesPage')
const LeadsPage = named(dash, 'LeadsPage')
const AnalyticsPage = named(dash, 'AnalyticsPage')
const PaymentsPage = named(dash, 'PaymentsPage')
const ProfilePage = named(dash, 'ProfilePage')
const SettingsPage = named(dash, 'SettingsPage')
const dealerSettings = () => import('../pages/dashboard/DealerSettingsPages')
const DealerStorefrontPage = named(dealerSettings, 'DealerStorefrontPage')
const StaffPage = named(dealerSettings, 'StaffPage')
const adminOverview = () => import('../pages/admin/AdminOverview')
const AdminLayout = named(adminOverview, 'AdminLayout')
const AdminOverviewPage = named(adminOverview, 'AdminOverviewPage')
const AdminAnalyticsPage = named(adminOverview, 'AdminAnalyticsPage')
const AdminVehiclesPage = named(() => import('../pages/admin/AdminVehicles'), 'AdminVehiclesPage')
const people = () => import('../pages/admin/AdminPeople')
const AdminUsersPage = named(people, 'AdminUsersPage')
const AdminDealersPage = named(people, 'AdminDealersPage')
const crud = () => import('../pages/admin/AdminCrud')
const AdminBrandsPage = named(crud, 'AdminBrandsPage')
const AdminModelsPage = named(crud, 'AdminModelsPage')
const AdminCategoriesPage = named(crud, 'AdminCategoriesPage')
const AdminPackagesPage = named(crud, 'AdminPackagesPage')
const AdminPromotionsPage = named(crud, 'AdminPromotionsPage')
const AdminCmsPage = named(crud, 'AdminCmsPage')
const AdminSeoPage = named(crud, 'AdminSeoPage')
const ops = () => import('../pages/admin/AdminOps')
const AdminReportsPage = named(ops, 'AdminReportsPage')
const AdminPaymentsPage = named(ops, 'AdminPaymentsPage')
const AdminMessagesPage = named(ops, 'AdminMessagesPage')
const AdminHomepagePage = named(ops, 'AdminHomepagePage')
const AdminAuditLogsPage = named(ops, 'AdminAuditLogsPage')
const AdminSettingsPage = named(ops, 'AdminSettingsPage')

const cms = (slug) => ({ path: slug, element: <CmsPage slug={slug} /> })
const S = (el) => <Suspense fallback={<FullPageSpinner />}>{el}</Suspense>

export const routes = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'cars', element: <CarsPage /> },
      { path: 'cars/body/:body', element: <CarsPage landingKind="body" /> },
      { path: 'cars/price/:range', element: <CarsPage landingKind="price" /> },
      { path: 'cars/:make', element: <CarsPage landingKind="make" /> },
      { path: 'cars/:make/:model', element: <CarsPage landingKind="make" /> },
      { path: 'vehicle/:slug', element: <VehicleDetailPage /> },
      { path: 'dealers', element: <DealersPage /> },
      { path: 'dealer/:slug', element: <DealerPage /> },
      { path: 'sell', element: <SellLandingPage /> },
      { path: 'sell/vehicle', element: <RequireAuth><SellVehiclePage /></RequireAuth> },
      ...['about', 'faq', 'how-it-works', 'safety', 'terms', 'privacy', 'help'].map(cms),
      { path: 'contact', element: <ContactPage /> },
      { path: 'sitemap', element: <SitemapPage /> },
      { path: 'saved', element: <RequireAuth><SavedPage /></RequireAuth> },
      { path: 'messages', element: <RequireAuth><MessagesPage /></RequireAuth> },
      { path: 'account', element: <RequireAuth><AccountPage /></RequireAuth> },
      {
        path: 'dashboard',
        element: <RequireAuth>{S(<DashboardLayout />)}</RequireAuth>,
        children: [
          { index: true, element: S(<DashboardHome />) },
          { path: 'listings', element: <RequireAuth roles={SELLER_ROLES}>{S(<MyListingsPage />)}</RequireAuth> },
          { path: 'messages', element: S(<DashboardMessagesPage />) },
          { path: 'leads', element: <RequireAuth roles={SELLER_ROLES}>{S(<LeadsPage />)}</RequireAuth> },
          { path: 'analytics', element: <RequireAuth roles={SELLER_ROLES}>{S(<AnalyticsPage />)}</RequireAuth> },
          { path: 'payments', element: <RequireAuth roles={SELLER_ROLES}>{S(<PaymentsPage />)}</RequireAuth> },
          { path: 'dealer', element: <RequireAuth roles={['DEALER', 'DEALER_STAFF']}>{S(<DealerStorefrontPage />)}</RequireAuth> },
          { path: 'staff', element: <RequireAuth roles={['DEALER', 'DEALER_STAFF']}>{S(<StaffPage />)}</RequireAuth> },
          { path: 'profile', element: S(<ProfilePage />) },
          { path: 'settings', element: S(<SettingsPage />) },
        ],
      },
      {
        path: 'admin',
        element: <RequireAuth roles={ADMIN_ROLES}>{S(<AdminLayout />)}</RequireAuth>,
        children: [
          { index: true, element: S(<AdminOverviewPage />) },
          { path: 'vehicles', element: S(<AdminVehiclesPage key="vehicles" />) },
          { path: 'listings', element: S(<AdminVehiclesPage key="queue" queue />) },
          { path: 'users', element: S(<AdminUsersPage key="users" />) },
          { path: 'sellers', element: S(<AdminUsersPage key="sellers" sellersOnly />) },
          { path: 'dealers', element: S(<AdminDealersPage />) },
          { path: 'brands', element: S(<AdminBrandsPage />) },
          { path: 'models', element: S(<AdminModelsPage />) },
          { path: 'categories', element: S(<AdminCategoriesPage />) },
          { path: 'messages', element: S(<AdminMessagesPage />) },
          { path: 'reports', element: S(<AdminReportsPage />) },
          { path: 'payments', element: S(<AdminPaymentsPage />) },
          { path: 'packages', element: S(<AdminPackagesPage />) },
          { path: 'promotions', element: S(<AdminPromotionsPage />) },
          { path: 'homepage', element: S(<AdminHomepagePage />) },
          { path: 'cms', element: S(<AdminCmsPage />) },
          { path: 'seo', element: S(<AdminSeoPage />) },
          { path: 'analytics', element: S(<AdminAnalyticsPage />) },
          { path: 'audit-logs', element: S(<AdminAuditLogsPage />) },
          { path: 'settings', element: S(<AdminSettingsPage />) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <BareLayout />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
]
