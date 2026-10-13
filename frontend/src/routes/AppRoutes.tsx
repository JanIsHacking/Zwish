import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { BikeFormPage } from '../features/bikes/BikeFormPage';
import { BikesPage } from '../features/bikes/BikesPage';
import { HomePage } from '../features/home/HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { PlanDetailPage } from '../features/plans/PlanDetailPage';
import { PlansPage } from '../features/plans/PlansPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { RidePage } from '../features/ride/RidePage';
import { RidersPage } from '../features/users/RidersPage';
import { TrainerDetailPage } from '../features/trainers/TrainerDetailPage';
import { TrainerFormPage } from '../features/trainers/TrainerFormPage';
import { TrainersPage } from '../features/trainers/TrainersPage';
import { WorkoutPage } from '../features/workouts/WorkoutPage';
import { ZoneTestsPage } from '../features/zone-tests/ZoneTestsPage';
import { useAuth } from '../shared/auth/auth-context';
import { AppShell } from '../shared/layouts/AppShell';

function RequireAuth() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <p className="p-10 text-muted">Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <RidersPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/:id" element={<PlanDetailPage />} />
          <Route path="/bikes" element={<BikesPage />} />
          <Route path="/bikes/new" element={<BikeFormPage />} />
          <Route path="/bikes/:id" element={<BikeFormPage />} />
          <Route path="/trainers" element={<TrainersPage />} />
          <Route path="/trainers/new" element={<TrainerFormPage />} />
          <Route path="/trainers/:id" element={<TrainerDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/riders" element={<RequireAdmin />} />
          <Route path="/zone-tests" element={<ZoneTestsPage />} />
          <Route path="/workouts/:id" element={<WorkoutPage />} />
        </Route>
        <Route path="/ride/:id" element={<RidePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
