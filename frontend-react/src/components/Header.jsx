import { UserRound } from "lucide-react";

function Header() {
  return (
    <header className="top-header">
      <div className="header-title">
        <h2>Dashboard</h2>
        <p>Selamat datang di CareLog</p>
      </div>

      <div className="header-profile">
        <div className="profile-avatar">
          <UserRound size={22} />
        </div>

        <div className="profile-info">
          <h4>Kader Posyandu</h4>
          <p>Administrator</p>
        </div>
      </div>
    </header>
  );
}

export default Header;