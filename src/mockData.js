const generateUsers = () => {
  const users = [];
  const companies = ["Google", "Microsoft", "Amazon", "Stripe", "Shopify", "Netflix", "Uber", "Airbnb", "Salesforce", "Oracle"];
  const roles = ["Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "DevOps Engineer", "Platform Engineer"];

  for (let i = 1; i <= 2000; i++) {
    const DemosGenerated = Math.floor(Math.random() * 500);
    const lastActive = new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000);
    const daysInactive = Math.floor((Date.now() - lastActive) / (1000 * 60 * 60 * 24));

    let userType;
    if (DemosGenerated > 300) userType = "Power User";
    else if (DemosGenerated > 100) userType = "Active User";
    else if (DemosGenerated > 20) userType = "Casual User";
    else userType = "Inactive User";

    users.push({
      id: i,
      name: `User ${i}`,
      company: companies[Math.floor(Math.random() * companies.length)],
      role: roles[Math.floor(Math.random() * roles.length)],
      DemosGenerated,
      lastActive: lastActive.toISOString().split("T")[0],
      daysInactive,
      userType,
      joinedDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
  }
  return users;
};

export const users = generateUsers();

export const getUserStats = () => {
  const total = users.length;
  const powerUsers = users.filter(u => u.userType === "Power User").length;
  const activeUsers = users.filter(u => u.userType === "Active User").length;
  const casualUsers = users.filter(u => u.userType === "Casual User").length;
  const inactiveUsers = users.filter(u => u.userType === "Inactive User").length;
  const avgDemos = Math.floor(users.reduce((sum, u) => sum + u.DemosGenerated, 0) / total);
  const totalDemos = users.reduce((sum, u) => sum + u.DemosGenerated, 0);

  return { total, powerUsers, activeUsers, casualUsers, inactiveUsers, avgDemos, totalDemos };
};

export const getCompanyStats = () => {
  const companyMap = {};
  users.forEach(u => {
    if (!companyMap[u.company]) companyMap[u.company] = { company: u.company, users: 0, totalDemos: 0 };
    companyMap[u.company].users++;
    companyMap[u.company].totalDemos += u.DemosGenerated;
  });
  return Object.values(companyMap).sort((a, b) => b.totalDemos - a.totalDemos);
};

export const getUserTypeData = () => {
  const stats = getUserStats();
  return [
    { name: "Power Users", value: stats.powerUsers },
    { name: "Active Users", value: stats.activeUsers },
    { name: "Casual Users", value: stats.casualUsers },
    { name: "Inactive Users", value: stats.inactiveUsers },
  ];
};

export const getMonthlyGrowth = () => {
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const baseUsers = 600;
  return months.map((month, i) => ({
    month,
    users: Math.floor(baseUsers + (1400 / 6) * i + Math.random() * 50),
  }));
};