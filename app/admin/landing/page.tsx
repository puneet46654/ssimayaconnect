export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-secondary mb-2">Dashboard</h1>
          <p className="text-gray-500">Welcome back to your administration portal. Monitor active conferences, manage bookings, and export analytics.</p>
        </div>
        <span className="badge badge--success py-1.5 px-3">
          <span className="w-2 h-2 rounded-full bg-success mr-1"></span>
          System Live
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Total Events</p>
          <h2 className="text-4xl font-bold text-secondary mb-1">12</h2>
          <p className="text-sm text-gray-500">3 currently live today</p>
        </div>
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Total Bookings</p>
          <h2 className="text-4xl font-bold text-secondary mb-1">847</h2>
          <p className="text-sm text-gray-500">+18% increase this week</p>
        </div>
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Today's Attendance</p>
          <h2 className="text-4xl font-bold text-secondary mb-1">156</h2>
          <p className="text-sm text-gray-500">Marked present via QR scan</p>
        </div>
        <div className="card">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Available Slots</p>
          <h2 className="text-4xl font-bold text-secondary mb-1">324</h2>
          <p className="text-sm text-gray-500">Across all future events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-secondary">Recent Bookings</h3>
            <a href="#" className="text-sm font-semibold text-primary flex items-center hover:text-primary-dark transition-colors">
              View All Bookings <span className="ml-1">→</span>
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Attendee</th>
                  <th>Conference Event</th>
                  <th>Date</th>
                  <th>Time Slot</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium text-gray-900">MC-04782</td>
                  <td>Dr. Alok Sen</td>
                  <td className="text-gray-900 font-medium text-sm">Annual Cardiology Summit 2026</td>
                  <td className="text-sm">19 Jul '26</td>
                  <td className="text-sm">10:00-10:30</td>
                  <td><span className="badge badge--success">Present</span></td>
                </tr>
                <tr>
                  <td className="font-medium text-gray-900">MC-04783</td>
                  <td>Dr. Neha Sharma</td>
                  <td className="text-gray-900 font-medium text-sm">Pediatric Innovations Forum</td>
                  <td className="text-sm">18 Jul '26</td>
                  <td className="text-sm">14:15-14:45</td>
                  <td><span className="badge badge--success">Present</span></td>
                </tr>
                <tr>
                  <td className="font-medium text-gray-900">MC-04784</td>
                  <td>Dr. Rohan Roy</td>
                  <td className="text-gray-900 font-medium text-sm">Neurological Disorders Masterclass</td>
                  <td className="text-sm">24 Jul '26</td>
                  <td className="text-sm">11:30-12:00</td>
                  <td><span className="badge badge--danger">Not Attended</span></td>
                </tr>
                <tr>
                  <td className="font-medium text-gray-900">MC-04785</td>
                  <td>Dr. Priya Patel</td>
                  <td className="text-gray-900 font-medium text-sm">Oncology Digital Diagnostics</td>
                  <td className="text-sm">12 Aug '26</td>
                  <td className="text-sm">09:00-09:30</td>
                  <td><span className="badge badge--success">Present</span></td>
                </tr>
                <tr>
                  <td className="font-medium text-gray-900">MC-04786</td>
                  <td>Dr. Amit Verma</td>
                  <td className="text-gray-900 font-medium text-sm">Orthopedic Prosthetics Expo</td>
                  <td className="text-sm">02 Aug '26</td>
                  <td className="text-sm">16:00-16:30</td>
                  <td><span className="badge badge--danger">Not Attended</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-secondary">Upcoming Events</h3>
            <a href="#" className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors">Manage List</a>
          </div>
          
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-secondary text-sm mb-1">Annual Cardiology Summit</h4>
                  <p className="text-xs text-gray-500">19-20 July 2026 • Mumbai</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-200">188</span>
                  <span className="text-xs text-gray-500 block">/200 slots</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-secondary h-1.5 rounded-full" style={{ width: '94%' }}></div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-secondary text-sm mb-1">Pediatric Innovations Forum</h4>
                  <p className="text-xs text-gray-500">18-19 July 2026 • Delhi</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-200">142</span>
                  <span className="text-xs text-gray-500 block">/150 slots</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-secondary h-1.5 rounded-full" style={{ width: '90%' }}></div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-secondary text-sm mb-1">Neurological Disorders Masterclass</h4>
                  <p className="text-xs text-gray-500">24 July 2026 • Bengaluru</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">64</span>
                  <span className="text-xs text-gray-500 block">/100 slots</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full" style={{ width: '64%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card flex flex-col sm:flex-row items-center justify-between gap-4">
        <h3 className="text-base font-bold text-secondary">Quick Operations</h3>
        <div className="flex gap-3">
          <button className="btn btn-primary">
            + Create New Event
          </button>
          <button className="btn text-gray-400 hover:text-gray-600">
            Manual Booking Override
          </button>
          <button className="btn btn-secondary border border-gray-200">
            Export Booking Ledger
          </button>
        </div>
      </div>
      
    </div>
  );
}