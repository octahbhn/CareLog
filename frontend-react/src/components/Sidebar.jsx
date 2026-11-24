import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Clock,
  HeartPulse,
} from "lucide-react";

function Sidebar() {
  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Data Warga", icon: Users },
    { name: "Pemeriksaan", icon: ClipboardList },
    { name: "Riwayat Pemeriksaan", icon: Clock },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-name">
          Care<span>Log.</span>
        </div>
        <p>Sistem Informasi Posyandu</p>
      </div>

      <div className="sidebar-menu">
        <p className="menu-heading">MENU UTAMA</p>

        <nav>
          {menuItems.map((item, index) => {
            const Icon = item.icon;

            return (
                <button
                key={item.name}
                className={`menu-item ${index === 0 ? "active" : ""}`}
                type="button"
                disabled={index !== 0}
                >
                <Icon size={20} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <p>CareLog © 2026</p>
      </div>
    </aside>
  );
}

export default Sidebar;