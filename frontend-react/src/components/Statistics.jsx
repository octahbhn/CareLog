const statisticsData = [
  {
    title: "Total Data Warga",
    value: "2",
    description: "Warga terdaftar",
  },
  {
    title: "Total Pemeriksaan",
    value: "2",
    description: "Catatan pemeriksaan",
  },
  {
    title: "Kategori Warga",
    value: "3",
    description: "Bayi/Balita, Ibu Hamil, Lansia",
  },
];

function Statistics() {
  return (
    <div className="statistics-grid">
      {statisticsData.map((item) => (
        <div className="stat-card" key={item.title}>
          <p className="stat-title">{item.title}</p>
          <h2>{item.value}</h2>
          <p className="stat-description">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export default Statistics;