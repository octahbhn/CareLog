
import Statistics from "../components/Statistics";
import { ClipboardCheck, UserRound } from "lucide-react";

const activities = [
  {
    id: 1,
    title: "Pemeriksaan Budi Santoso",
    description: "Pemeriksaan Bayi/Balita",
    date: "09 November 2026",
    icon: ClipboardCheck,
  },
  {
    id: 2,
    title: "Data Warga Dewi Anggraini",
    description: "Penambahan profil warga",
    date: "Data contoh",
    icon: UserRound,
  },
];

function Dashboard() {
  return (
    <main className="dashboard-content">
      <section className="welcome-section">
        <h1>Selamat Datang!</h1>
        <p>
          Kelola data warga dan pemeriksaan Posyandu dengan lebih mudah.
        </p>
      </section>

      <Statistics />

      <section className="activity-card">
        <div className="activity-header">
          <h3>Aktivitas Posyandu</h3>
          <p>Ringkasan aktivitas pengelolaan data Posyandu.</p>
        </div>

        <div className="activity-list">
          {activities.map((activity) => {
            const Icon = activity.icon;

            return (
              <div className="activity-item" key={activity.id}>
                <div className="activity-icon">
                  <Icon size={22} />
                </div>

                <div className="activity-info">
                  <h4>{activity.title}</h4>
                  <p>{activity.description}</p>
                </div>

                <span className="activity-date">
                  {activity.date}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default Dashboard;