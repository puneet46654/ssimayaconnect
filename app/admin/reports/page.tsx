'use client';

import type {
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import * as XLSX from 'xlsx';

/* ============================================================
   TYPES
============================================================ */

type ReportSummary = {
  totalBookings: number;
  present: number;
  notPresent: number;
  attendanceRate: number;

  qrCheckIns: number;
  manualCheckIns: number;

  totalCapacity: number;
  reservedCapacity: number;
  remainingCapacity: number;
  slotUtilization: number;

  events: number;
  liveEvents: number;
};

type EventOption = {
  id: string;
  eventName: string;
  status: string;
};

type RegistrationTrend = {
  period: string;
  registered: number;
  present: number;
};

type EventAttendance = {
  event: string;
  fullEventName: string;
  present: number;
  notPresent: number;
};

type UtilizationChart = {
  event: string;
  fullEventName: string;
  utilization: number;
  booked: number;
  capacity: number;
};

type PieItem = {
  name: string;
  value: number;
};

type EventPerformance = {
  id: string;

  eventName: string;
  eventType: string;
  venue: string;
  status: string;

  startDate: string | null;
  endDate: string | null;

  registrations: number;
  present: number;
  notPresent: number;

  attendanceRate: number;

  capacity: number;
  bookedCapacity: number;
  utilization: number;
};

type BookingLedgerRow = {
  id: string;

  bookingId: string;

  fullName: string;
  email: string;
  mobile: string;

  designation: string;
  specialty: string;
  hospital: string;

  city: string;
  state: string;
  country: string;

  eventId: string;
  eventName: string;
  eventType: string;
  venue: string;
  eventStatus: string;

  scheduledDate: string | null;

  dayNumber: number | null;

  startTime: string;
  endTime: string;

  attendanceStatus:
    | 'PRESENT'
    | 'NOT_PRESENT';

  checkInMethod: string;

  checkedInAt: string | null;

  checkedInBy: string;

  createdAt: string;
};

type ReportResponse = {
  success: boolean;

  message?: string;

  generatedAt: string;

  eventOptions: EventOption[];

  summary: ReportSummary;

  charts: {
    registrationTrend: RegistrationTrend[];

    attendanceByEvent: EventAttendance[];

    utilizationByEvent: UtilizationChart[];

    attendanceStatus: PieItem[];

    checkInMethods: PieItem[];
  };

  eventPerformance: EventPerformance[];

  bookings: BookingLedgerRow[];
};

type FilterState = {
  eventId: string;

  from: string;

  to: string;

  attendance:
    | 'all'
    | 'present'
    | 'not_present';
};

/* ============================================================
   CONSTANTS
============================================================ */

const EMPTY_SUMMARY: ReportSummary = {
  totalBookings: 0,
  present: 0,
  notPresent: 0,
  attendanceRate: 0,

  qrCheckIns: 0,
  manualCheckIns: 0,

  totalCapacity: 0,
  reservedCapacity: 0,
  remainingCapacity: 0,
  slotUtilization: 0,

  events: 0,
  liveEvents: 0,
};

const EMPTY_FILTERS: FilterState = {
  eventId: '',
  from: '',
  to: '',
  attendance: 'all',
};

const PAGE_SIZE = 15;

const COLORS = {
  primary: '#1a9e8f',
  primaryLight: '#63c6b9',
  secondary: '#1b4b6b',
  blue: '#4387b3',
  green: '#2f9e76',
  amber: '#d49c35',
  red: '#d75d5d',
  grey: '#d8e0e5',
};

/* ============================================================
   PAGE
============================================================ */

export default function ReportsPage() {
  /* ==========================================================
     FILTERS
  ========================================================== */

  const [
    draft,
    setDraft,
  ] = useState<FilterState>(
    EMPTY_FILTERS,
  );

  const [
    filters,
    setFilters,
  ] = useState<FilterState>(
    EMPTY_FILTERS,
  );

  /* ==========================================================
     DATA
  ========================================================== */

  const [
    report,
    setReport,
  ] =
    useState<ReportResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    exporting,
    setExporting,
  ] = useState<
    '' | 'csv' | 'excel'
  >('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    page,
    setPage,
  ] = useState(1);

  /* ==========================================================
     LOAD REPORT
  ========================================================== */

  const loadReport =
    useCallback(
      async (
        quiet = false,
      ) => {
        if (quiet) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        setError('');

        try {
          const params =
            new URLSearchParams();

          if (
            filters.eventId
          ) {
            params.set(
              'eventId',
              filters.eventId,
            );
          }

          if (
            filters.from
          ) {
            params.set(
              'from',
              filters.from,
            );
          }

          if (
            filters.to
          ) {
            params.set(
              'to',
              filters.to,
            );
          }

          if (
            filters.attendance !==
            'all'
          ) {
            params.set(
              'attendance',
              filters.attendance,
            );
          }

          const response =
            await fetch(
              `/api/admin/reports?${params.toString()}`,
              {
                method:
                  'GET',

                credentials:
                  'include',

                cache:
                  'no-store',
              },
            );

          const data =
            (await response.json()) as ReportResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                'Unable to generate report.',
            );
          }

          setReport(
            data,
          );

          setPage(1);
        } catch (err) {
          console.error(
            'Report error:',
            err,
          );

          setError(
            err instanceof
              Error
              ? err.message
              : 'Unable to generate report.',
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [
        filters,
      ],
    );

  useEffect(() => {
    void loadReport();
  }, [
    loadReport,
  ]);

  /* ==========================================================
     SUMMARY
  ========================================================== */

  const summary =
    report?.summary ??
    EMPTY_SUMMARY;

  /* ==========================================================
     PAGINATION
  ========================================================== */

  const totalRows =
    report?.bookings
      .length ??
    0;

  const totalPages =
    Math.max(
      Math.ceil(
        totalRows /
          PAGE_SIZE,
      ),
      1,
    );

  const visibleBookings =
    useMemo(() => {
      if (!report) {
        return [];
      }

      const start =
        (page - 1) *
        PAGE_SIZE;

      return report.bookings.slice(
        start,
        start +
          PAGE_SIZE,
      );
    }, [
      report,
      page,
    ]);

  const rangeStart =
    totalRows === 0
      ? 0
      : (page - 1) *
          PAGE_SIZE +
        1;

  const rangeEnd =
    Math.min(
      page *
        PAGE_SIZE,
      totalRows,
    );

  /* ==========================================================
     FILTER ACTIONS
  ========================================================== */

  function applyFilters() {
    setPage(1);

    setFilters(
      draft,
    );
  }

  function clearFilters() {
    setDraft(
      EMPTY_FILTERS,
    );

    setFilters(
      EMPTY_FILTERS,
    );

    setPage(1);
  }

  function quickRange(
    days: number,
  ) {
    const end =
      new Date();

    const start =
      new Date();

    start.setDate(
      start.getDate() -
        (days - 1),
    );

    setDraft(
      (
        current,
      ) => ({
        ...current,

        from:
          toDateInput(
            start,
          ),

        to:
          toDateInput(
            end,
          ),
      }),
    );
  }

  /* ==========================================================
     CSV
  ========================================================== */

  function exportCsv() {
    if (
      !report ||
      report.bookings.length ===
        0
    ) {
      return;
    }

    setExporting(
      'csv',
    );

    try {
      const rows =
        buildExportRows(
          report.bookings,
        );

      const headers =
        Object.keys(
          rows[0],
        );

      const content = [
        headers
          .map(
            csvEscape,
          )
          .join(
            ',',
          ),

        ...rows.map(
          (
            row,
          ) =>
            headers
              .map(
                (
                  header,
                ) =>
                  csvEscape(
                    row[
                      header as keyof typeof row
                    ],
                  ),
              )
              .join(
                ',',
              ),
        ),
      ].join(
        '\n',
      );

      downloadBlob(
        new Blob(
          [
            '\uFEFF',
            content,
          ],
          {
            type:
              'text/csv;charset=utf-8;',
          },
        ),

        buildFilename(
          'SSI-Maya-Booking-Report',
          'csv',
        ),
      );
    } finally {
      setExporting('');
    }
  }

  /* ==========================================================
     EXCEL
  ========================================================== */

  function exportExcel() {
    if (!report) {
      return;
    }

    setExporting(
      'excel',
    );

    try {
      const overview = [
        {
          Metric:
            'Report Generated',

          Value:
            formatDateTime(
              report.generatedAt,
            ),
        },

        {
          Metric:
            'Total Registrations',

          Value:
            summary.totalBookings,
        },

        {
          Metric:
            'Present',

          Value:
            summary.present,
        },

        {
          Metric:
            'Not Present',

          Value:
            summary.notPresent,
        },

        {
          Metric:
            'Attendance Rate',

          Value:
            `${summary.attendanceRate}%`,
        },

        {
          Metric:
            'QR Check-ins',

          Value:
            summary.qrCheckIns,
        },

        {
          Metric:
            'Manual Check-ins',

          Value:
            summary.manualCheckIns,
        },

        {
          Metric:
            'Total Capacity',

          Value:
            summary.totalCapacity,
        },

        {
          Metric:
            'Reserved Capacity',

          Value:
            summary.reservedCapacity,
        },

        {
          Metric:
            'Remaining Capacity',

          Value:
            summary.remainingCapacity,
        },

        {
          Metric:
            'Slot Utilization',

          Value:
            `${summary.slotUtilization}%`,
        },
      ];

      const eventRows =
        report.eventPerformance.map(
          (
            event,
          ) => ({
            Event:
              event.eventName,

            Type:
              event.eventType,

            Venue:
              event.venue,

            Status:
              event.status,

            'Start Date':
              formatDate(
                event.startDate,
              ),

            'End Date':
              formatDate(
                event.endDate,
              ),

            Registrations:
              event.registrations,

            Present:
              event.present,

            'Not Present':
              event.notPresent,

            'Attendance Rate':
              `${event.attendanceRate}%`,

            Capacity:
              event.capacity,

            Reserved:
              event.bookedCapacity,

            'Slot Utilization':
              `${event.utilization}%`,
          }),
        );

      const bookingRows =
        buildExportRows(
          report.bookings,
        );

      const workbook =
        XLSX.utils.book_new();

      const summarySheet =
        XLSX.utils.json_to_sheet(
          overview,
        );

      const eventSheet =
        XLSX.utils.json_to_sheet(
          eventRows,
        );

      const bookingsSheet =
        XLSX.utils.json_to_sheet(
          bookingRows,
        );

      summarySheet['!cols'] = [
        {
          wch: 28,
        },
        {
          wch: 25,
        },
      ];

      eventSheet['!cols'] =
        Array.from(
          {
            length: 13,
          },
          () => ({
            wch: 20,
          }),
        );

      bookingsSheet['!cols'] =
        Array.from(
          {
            length: 20,
          },
          () => ({
            wch: 22,
          }),
        );

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        'Overview',
      );

      XLSX.utils.book_append_sheet(
        workbook,
        eventSheet,
        'Event Performance',
      );

      XLSX.utils.book_append_sheet(
        workbook,
        bookingsSheet,
        'Booking Ledger',
      );

      XLSX.writeFile(
        workbook,
        buildFilename(
          'SSI-Maya-Full-Report',
          'xlsx',
        ),
      );
    } finally {
      setExporting('');
    }
  }

  /* ==========================================================
     PRINT
  ========================================================== */

  function printReport() {
    window.print();
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div
      className="
        w-full
        min-w-0
        max-w-full
        overflow-x-hidden
        space-y-4

        sm:space-y-5
      "
    >
      {/* ======================================================
          PRINT HEADER
      ====================================================== */}

      <div
        className="
          hidden
          print:block
        "
      >
        <h1
          className="
            text-2xl
            font-bold
          "
        >
          SSI Maya Connect —
          Booking and Attendance
          Report
        </h1>

        <p>
          Generated:{' '}
          {formatDateTime(
            report?.generatedAt,
          )}
        </p>
      </div>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <header
        className="
          min-w-0
          print:hidden
        "
      >
        <div
          className="
            flex
            min-w-0
            flex-col
            gap-4

            lg:flex-row
            lg:items-start
            lg:justify-between
          "
        >
          <div
            className="
              min-w-0
            "
          >
            <h1
              className="
                font-heading

                text-[22px]
                font-bold

                tracking-[-0.03em]

                text-secondary

                sm:text-[25px]
                lg:text-[27px]
              "
            >
              Reports & Export
            </h1>

            <p
              className="
                mt-1

                max-w-[720px]

                text-[11px]
                leading-[18px]

                text-gray-500

                sm:text-[13px]
                sm:leading-5
              "
            >
              Operational
              reporting for
              registrations,
              attendance,
              check-ins and
              event capacity.
            </p>
          </div>

          {/* ================================================
              ACTION BUTTONS
          ================================================ */}

          <div
            className="
              grid
              w-full
              grid-cols-2
              gap-2

              min-[520px]:grid-cols-4

              lg:w-auto
              lg:flex
            "
          >
            <HeaderAction
              disabled={
                refreshing
              }
              onClick={() =>
                void loadReport(
                  true,
                )
              }
              icon={
                <RefreshIcon
                  spinning={
                    refreshing
                  }
                />
              }
            >
              Refresh
            </HeaderAction>

            <HeaderAction
              disabled={
                !report ||
                !report
                  .bookings
                  .length ||
                Boolean(
                  exporting,
                )
              }
              onClick={
                exportCsv
              }
              icon={
                <DownloadIcon />
              }
            >
              CSV
            </HeaderAction>

            <HeaderAction
              primary
              disabled={
                !report ||
                Boolean(
                  exporting,
                )
              }
              onClick={
                exportExcel
              }
              icon={
                <ExcelIcon />
              }
            >
              {exporting ===
              'excel'
                ? 'Exporting'
                : 'Excel'}
            </HeaderAction>

            <HeaderAction
              disabled={
                !report
              }
              onClick={
                printReport
              }
              icon={
                <PrintIcon />
              }
            >
              PDF
            </HeaderAction>
          </div>
        </div>
      </header>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <section
        className="
          min-w-0

          rounded-xl

          border
          border-gray-200

          bg-white

          shadow-sm

          print:hidden
        "
      >
        {/* QUICK RANGE */}

        <div
          className="
            border-b
            border-gray-100

            px-3
            py-3

            sm:px-4
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              gap-2

              overflow-x-auto

              pb-1

              [scrollbar-width:none]

              [&::-webkit-scrollbar]:hidden
            "
          >
            <span
              className="
                shrink-0

                text-[10px]
                font-semibold

                text-gray-500
              "
            >
              Quick range
            </span>

            <QuickButton
              onClick={() =>
                quickRange(
                  1,
                )
              }
            >
              Today
            </QuickButton>

            <QuickButton
              onClick={() =>
                quickRange(
                  7,
                )
              }
            >
              Last 7 Days
            </QuickButton>

            <QuickButton
              onClick={() =>
                quickRange(
                  30,
                )
              }
            >
              Last 30 Days
            </QuickButton>

            <QuickButton
              onClick={() =>
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    from: '',
                    to: '',
                  }),
                )
              }
            >
              All Time
            </QuickButton>
          </div>
        </div>

        <div
          className="
            grid
            min-w-0
            grid-cols-1
            gap-3

            p-3

            sm:grid-cols-2
            sm:p-4

            xl:grid-cols-[minmax(220px,1.35fr)_minmax(155px,0.72fr)_minmax(155px,0.72fr)_minmax(170px,0.8fr)_auto]
          "
        >
          <FilterField
            label="Event"
          >
            <select
              value={
                draft.eventId
              }
              onChange={(
                event,
              ) =>
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    eventId:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="
                form-select
                w-full
                min-w-0
              "
            >
              <option value="">
                All Events
              </option>

              {report?.eventOptions.map(
                (
                  event,
                ) => (
                  <option
                    key={
                      event.id
                    }
                    value={
                      event.id
                    }
                  >
                    {
                      event.eventName
                    }{' '}
                    ({event.status})
                  </option>
                ),
              )}
            </select>
          </FilterField>

          <FilterField
            label="Registered From"
          >
            <input
              type="date"
              value={
                draft.from
              }
              onChange={(
                event,
              ) =>
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    from:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="
                form-input
                w-full
                min-w-0
              "
            />
          </FilterField>

          <FilterField
            label="Registered To"
          >
            <input
              type="date"
              value={
                draft.to
              }
              onChange={(
                event,
              ) =>
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    to:
                      event
                        .target
                        .value,
                  }),
                )
              }
              className="
                form-input
                w-full
                min-w-0
              "
            />
          </FilterField>

          <FilterField
            label="Attendance"
          >
            <select
              value={
                draft.attendance
              }
              onChange={(
                event,
              ) =>
                setDraft(
                  (
                    current,
                  ) => ({
                    ...current,

                    attendance:
                      event
                        .target
                        .value as FilterState['attendance'],
                  }),
                )
              }
              className="
                form-select
                w-full
                min-w-0
              "
            >
              <option value="all">
                All Records
              </option>

              <option value="present">
                Present
              </option>

              <option value="not_present">
                Not Present
              </option>
            </select>
          </FilterField>

          <div
            className="
              grid
              grid-cols-2
              gap-2

              sm:col-span-2

              xl:col-span-1
              xl:flex
              xl:items-end
            "
          >
            <button
              type="button"
              onClick={
                applyFilters
              }
              className="
                btn
                btn-primary

                min-h-[42px]
                w-full

                xl:w-auto
              "
            >
              Apply Filters
            </button>

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="
                btn

                min-h-[42px]
                w-full

                border-gray-200

                bg-white

                text-gray-500

                xl:w-auto
              "
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div
          className="
            rounded-xl

            border
            border-red-200

            bg-red-50

            px-3
            py-3

            text-[12px]
            leading-5

            text-red-700

            sm:px-4
            sm:text-[13px]

            print:hidden
          "
        >
          {error}
        </div>
      )}

      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <div
        className="
          grid
          min-w-0
          grid-cols-1
          gap-3

          min-[360px]:grid-cols-2

          md:grid-cols-3

          xl:grid-cols-6
        "
      >
        <MetricCard
          title="Registrations"
          value={
            summary.totalBookings
          }
          subtitle={`${summary.events} events`}
          icon={
            <BookingIcon />
          }
          loading={
            loading
          }
        />

        <MetricCard
          title="Present"
          value={
            summary.present
          }
          subtitle={`${summary.attendanceRate}% attendance`}
          icon={
            <PresentIcon />
          }
          positive
          loading={
            loading
          }
        />

        <MetricCard
          title="Not Present"
          value={
            summary.notPresent
          }
          subtitle="Awaiting / absent"
          icon={
            <AbsentIcon />
          }
          loading={
            loading
          }
        />

        <MetricCard
          title="QR Check-ins"
          value={
            summary.qrCheckIns
          }
          subtitle={`${summary.manualCheckIns} manual`}
          icon={
            <QrIcon />
          }
          loading={
            loading
          }
        />

        <MetricCard
          title="Capacity"
          value={
            summary.totalCapacity
          }
          subtitle={`${summary.remainingCapacity} remaining`}
          icon={
            <CapacityIcon />
          }
          loading={
            loading
          }
        />

        <MetricCard
          title="Utilization"
          value={`${summary.slotUtilization}%`}
          subtitle={`${summary.reservedCapacity} reserved`}
          icon={
            <ChartIcon />
          }
          loading={
            loading
          }
        />
      </div>

      {/* ======================================================
          REGISTRATION TREND
      ====================================================== */}

      <ReportCard>
        <ChartHeader
          title="Registration Trend"
          description="Registrations over the selected reporting period."
        />

        <div
          className="
            h-[270px]
            min-w-0
            w-full

            p-2

            min-[420px]:h-[300px]

            sm:h-[340px]
            sm:p-4

            lg:p-5
          "
        >
          {loading ? (
            <ChartSkeleton />
          ) : report
              ?.charts
              .registrationTrend
              .length ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={
                  report
                    .charts
                    .registrationTrend
                }
                margin={{
                  top: 10,
                  right: 4,
                  left: -26,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="registrations"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={
                        COLORS.primary
                      }
                      stopOpacity={
                        0.25
                      }
                    />

                    <stop
                      offset="95%"
                      stopColor={
                        COLORS.primary
                      }
                      stopOpacity={
                        0
                      }
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={
                    false
                  }
                  stroke="#edf0f2"
                />

                <XAxis
                  dataKey="period"
                  minTickGap={
                    20
                  }
                  tick={{
                    fontSize: 9,
                    fill: '#77838d',
                  }}
                  axisLine={
                    false
                  }
                  tickLine={
                    false
                  }
                />

                <YAxis
                  allowDecimals={
                    false
                  }
                  width={
                    40
                  }
                  tick={{
                    fontSize: 9,
                    fill: '#77838d',
                  }}
                  axisLine={
                    false
                  }
                  tickLine={
                    false
                  }
                />

                <Tooltip
                  contentStyle={
                    tooltipStyle
                  }
                />

                <Legend
                  wrapperStyle={{
                    fontSize:
                      '10px',
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="registered"
                  name="Registrations"
                  stroke={
                    COLORS.primary
                  }
                  strokeWidth={
                    2.5
                  }
                  fill="url(#registrations)"
                />

                <Area
                  type="monotone"
                  dataKey="present"
                  name="Present"
                  stroke={
                    COLORS.secondary
                  }
                  strokeWidth={
                    2
                  }
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </ReportCard>

      {/* ======================================================
          SECONDARY CHARTS
      ====================================================== */}

      <div
        className="
          grid
          min-w-0
          grid-cols-1
          gap-4

          xl:grid-cols-2
          xl:gap-5
        "
      >
        <ReportCard>
          <ChartHeader
            title="Attendance by Event"
            description="Present versus not-present registrations."
          />

          <div
            className="
              h-[320px]
              min-w-0

              p-2

              sm:h-[350px]
              sm:p-4
            "
          >
            {loading ? (
              <ChartSkeleton />
            ) : report
                ?.charts
                .attendanceByEvent
                .length ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    report
                      .charts
                      .attendanceByEvent
                  }
                  margin={{
                    top: 5,
                    right: 5,
                    left: -25,
                    bottom: 50,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={
                      false
                    }
                    stroke="#edf0f2"
                  />

                  <XAxis
                    dataKey="event"
                    angle={
                      -30
                    }
                    textAnchor="end"
                    height={
                      70
                    }
                    interval={
                      0
                    }
                    tick={{
                      fontSize: 8,
                      fill: '#77838d',
                    }}
                    axisLine={
                      false
                    }
                    tickLine={
                      false
                    }
                  />

                  <YAxis
                    allowDecimals={
                      false
                    }
                    width={
                      38
                    }
                    tick={{
                      fontSize: 9,
                      fill: '#77838d',
                    }}
                    axisLine={
                      false
                    }
                    tickLine={
                      false
                    }
                  />

                  <Tooltip
                    contentStyle={
                      tooltipStyle
                    }
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize:
                        '10px',
                    }}
                  />

                  <Bar
                    dataKey="present"
                    name="Present"
                    stackId="attendance"
                    fill={
                      COLORS.primary
                    }
                  />

                  <Bar
                    dataKey="notPresent"
                    name="Not Present"
                    stackId="attendance"
                    fill={
                      COLORS.grey
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </div>
        </ReportCard>

        <ReportCard>
          <ChartHeader
            title="Slot Utilization by Event"
            description="Reserved capacity as a percentage of configured capacity."
          />

          <div
            className="
              h-[330px]
              min-w-0

              p-2

              sm:h-[350px]
              sm:p-4
            "
          >
            {loading ? (
              <ChartSkeleton />
            ) : report
                ?.charts
                .utilizationByEvent
                .length ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    report
                      .charts
                      .utilizationByEvent
                  }
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 15,
                    left: -10,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={
                      false
                    }
                    stroke="#edf0f2"
                  />

                  <XAxis
                    type="number"
                    domain={[
                      0,
                      100,
                    ]}
                    unit="%"
                    tick={{
                      fontSize: 9,
                      fill: '#77838d',
                    }}
                    axisLine={
                      false
                    }
                    tickLine={
                      false
                    }
                  />

                  <YAxis
                    type="category"
                    dataKey="event"
                    width={
                      90
                    }
                    tick={{
                      fontSize: 8,
                      fill: '#77838d',
                    }}
                    axisLine={
                      false
                    }
                    tickLine={
                      false
                    }
                  />

                  <Tooltip
                    formatter={(
                      value,
                    ) => [
                      `${value}%`,
                      'Utilization',
                    ]}
                    contentStyle={
                      tooltipStyle
                    }
                  />

                  <Bar
                    dataKey="utilization"
                    name="Utilization"
                    fill={
                      COLORS.secondary
                    }
                    radius={[
                      0,
                      5,
                      5,
                      0,
                    ]}
                    barSize={
                      16
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </div>
        </ReportCard>
      </div>

      {/* ======================================================
          DONUTS
      ====================================================== */}

      <div
        className="
          grid
          min-w-0
          grid-cols-1
          gap-4

          md:grid-cols-2
          md:gap-5
        "
      >
        <DonutCard
          title="Attendance Status"
          description="Overall attendance composition."
          data={
            report?.charts
              .attendanceStatus ??
            []
          }
          colors={[
            COLORS.primary,
            COLORS.grey,
          ]}
          loading={
            loading
          }
          centerValue={`${summary.attendanceRate}%`}
          centerLabel="Attendance"
        />

        <DonutCard
          title="Check-in Method"
          description="How verified attendees were checked in."
          data={
            report?.charts
              .checkInMethods ??
            []
          }
          colors={[
            COLORS.secondary,
            COLORS.amber,
          ]}
          loading={
            loading
          }
          centerValue={
            summary.present
          }
          centerLabel="Verified"
        />
      </div>

      {/* ======================================================
          EVENT PERFORMANCE
      ====================================================== */}

      <ReportCard
        printClassName="print:break-before-page"
      >
        <SectionHeader
          title="Event Performance"
          description="Registration, attendance and capacity performance for each event."
        />

        {/* MOBILE CARDS */}

        <div
          className="
            divide-y
            divide-gray-100

            lg:hidden
          "
        >
          {loading ? (
            <>
              <MobileCardSkeleton />
              <MobileCardSkeleton />
              <MobileCardSkeleton />
            </>
          ) : report
              ?.eventPerformance
              .length ? (
            report.eventPerformance.map(
              (
                event,
              ) => (
                <EventPerformanceCard
                  key={
                    event.id
                  }
                  event={
                    event
                  }
                />
              ),
            )
          ) : (
            <MobileEmpty
              text="No event data for the selected filters."
            />
          )}
        </div>

        {/* DESKTOP TABLE */}

        <div
          className="
            hidden
            overflow-x-auto

            lg:block
          "
        >
          <table
            className="
              data-table
              min-w-[1100px]
            "
          >
            <thead>
              <tr>
                <th>
                  Event
                </th>

                <th>
                  Status
                </th>

                <th>
                  Registrations
                </th>

                <th>
                  Present
                </th>

                <th>
                  Not Present
                </th>

                <th>
                  Attendance
                </th>

                <th>
                  Capacity
                </th>

                <th>
                  Reserved
                </th>

                <th>
                  Utilization
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <TableSkeleton
                  columns={
                    9
                  }
                />
              ) : report
                  ?.eventPerformance
                  .length ? (
                report.eventPerformance.map(
                  (
                    event,
                  ) => (
                    <tr
                      key={
                        event.id
                      }
                    >
                      <td>
                        <div
                          className="
                            max-w-[260px]
                          "
                        >
                          <p
                            className="
                              truncate
                              font-semibold
                              text-secondary
                            "
                          >
                            {
                              event.eventName
                            }
                          </p>

                          <p
                            className="
                              mt-0.5
                              truncate
                              text-[10px]
                              text-gray-400
                            "
                          >
                            {
                              event.venue ||
                              '—'
                            }
                          </p>
                        </div>
                      </td>

                      <td>
                        <EventStatus
                          status={
                            event.status
                          }
                        />
                      </td>

                      <td>
                        {
                          event.registrations
                        }
                      </td>

                      <td
                        className="
                          font-semibold
                          text-primary
                        "
                      >
                        {
                          event.present
                        }
                      </td>

                      <td>
                        {
                          event.notPresent
                        }
                      </td>

                      <td>
                        <RateCell
                          value={
                            event.attendanceRate
                          }
                        />
                      </td>

                      <td>
                        {
                          event.capacity
                        }
                      </td>

                      <td>
                        {
                          event.bookedCapacity
                        }
                      </td>

                      <td>
                        <RateCell
                          value={
                            event.utilization
                          }
                        />
                      </td>
                    </tr>
                  ),
                )
              ) : (
                <EmptyRow
                  columns={
                    9
                  }
                  text="No event data for the selected filters."
                />
              )}
            </tbody>
          </table>
        </div>
      </ReportCard>

      {/* ======================================================
          BOOKING LEDGER
      ====================================================== */}

      <ReportCard
        printClassName="print:break-before-page"
      >
        <div
          className="
            flex
            flex-col
            gap-2

            border-b
            border-gray-200

            px-3
            py-3.5

            sm:flex-row
            sm:items-center
            sm:justify-between

            sm:px-5
            sm:py-4
          "
        >
          <div
            className="
              min-w-0
            "
          >
            <h2
              className="
                text-[14px]
                font-semibold

                text-secondary

                sm:text-[15px]
              "
            >
              Detailed Booking
              Ledger
            </h2>

            <p
              className="
                mt-0.5

                text-[10px]
                leading-4

                text-gray-500

                sm:text-[11px]
              "
            >
              Full registration
              and attendance audit
              trail.
            </p>
          </div>

          {!loading &&
            report && (
              <p
                className="
                  text-[10px]
                  text-gray-500

                  sm:text-[11px]

                  print:hidden
                "
              >
                Showing{' '}
                <strong
                  className="
                    text-secondary
                  "
                >
                  {rangeStart}–
                  {rangeEnd}
                </strong>{' '}
                of{' '}
                <strong
                  className="
                    text-secondary
                  "
                >
                  {totalRows}
                </strong>
              </p>
            )}
        </div>

        {/* MOBILE LEDGER */}

        <div
          className="
            divide-y
            divide-gray-100

            lg:hidden
          "
        >
          {loading ? (
            <>
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </>
          ) : visibleBookings.length ? (
            visibleBookings.map(
              (
                booking,
              ) => (
                <BookingMobileCard
                  key={
                    booking.id
                  }
                  booking={
                    booking
                  }
                />
              ),
            )
          ) : (
            <MobileEmpty
              text="No bookings match the current report filters."
            />
          )}
        </div>

        {/* DESKTOP LEDGER */}

        <div
          className="
            hidden
            overflow-x-auto

            lg:block
          "
        >
          <table
            className="
              data-table
              min-w-[1600px]
            "
          >
            <thead>
              <tr>
                <th>
                  Booking ID
                </th>

                <th>
                  Attendee
                </th>

                <th>
                  Contact
                </th>

                <th>
                  Hospital /
                  Specialty
                </th>

                <th>
                  Event
                </th>

                <th>
                  Schedule
                </th>

                <th>
                  Attendance
                </th>

                <th>
                  Check-in
                  Method
                </th>

                <th>
                  Checked In
                </th>

                <th>
                  Checked In By
                </th>

                <th>
                  Registered
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <TableSkeleton
                  columns={
                    11
                  }
                />
              ) : visibleBookings.length ? (
                visibleBookings.map(
                  (
                    booking,
                  ) => (
                    <tr
                      key={
                        booking.id
                      }
                    >
                      <td>
                        <span
                          className="
                            font-mono

                            text-[11px]
                            font-semibold

                            text-secondary
                          "
                        >
                          {
                            booking.bookingId
                          }
                        </span>
                      </td>

                      <td>
                        <p
                          className="
                            font-semibold
                            text-gray-700
                          "
                        >
                          {
                            booking.fullName
                          }
                        </p>

                        <p
                          className="
                            mt-0.5

                            text-[10px]
                            text-gray-400
                          "
                        >
                          {[
                            booking.designation,
                            booking.city,
                            booking.country,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              ' • ',
                            ) ||
                            '—'}
                        </p>
                      </td>

                      <td>
                        <p>
                          {
                            booking.email ||
                            '—'
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-gray-400
                          "
                        >
                          {
                            booking.mobile ||
                            '—'
                          }
                        </p>
                      </td>

                      <td>
                        <p>
                          {
                            booking.hospital ||
                            '—'
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-gray-400
                          "
                        >
                          {
                            booking.specialty ||
                            '—'
                          }
                        </p>
                      </td>

                      <td>
                        <p
                          className="
                            max-w-[220px]
                            truncate
                            font-medium
                          "
                        >
                          {
                            booking.eventName
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-gray-400
                          "
                        >
                          {
                            booking.venue ||
                            '—'
                          }
                        </p>
                      </td>

                      <td>
                        <p>
                          {
                            formatDate(
                              booking.scheduledDate,
                            )
                          }
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[10px]
                            text-gray-400
                          "
                        >
                          {
                            formatSlot(
                              booking.startTime,
                              booking.endTime,
                            )
                          }
                        </p>
                      </td>

                      <td>
                        <AttendanceBadge
                          status={
                            booking.attendanceStatus
                          }
                        />
                      </td>

                      <td>
                        {
                          booking.checkInMethod ||
                          '—'
                        }
                      </td>

                      <td>
                        {
                          formatDateTime(
                            booking.checkedInAt,
                          )
                        }
                      </td>

                      <td>
                        {
                          booking.checkedInBy ||
                          '—'
                        }
                      </td>

                      <td>
                        {
                          formatDateTime(
                            booking.createdAt,
                          )
                        }
                      </td>
                    </tr>
                  ),
                )
              ) : (
                <EmptyRow
                  columns={
                    11
                  }
                  text="No bookings match the current report filters."
                />
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        {!loading &&
          totalRows >
            PAGE_SIZE && (
            <MobilePagination
              page={
                page
              }
              totalPages={
                totalPages
              }
              rangeStart={
                rangeStart
              }
              rangeEnd={
                rangeEnd
              }
              total={
                totalRows
              }
              onPrevious={() =>
                setPage(
                  (
                    current,
                  ) =>
                    Math.max(
                      1,
                      current -
                        1,
                    ),
                )
              }
              onNext={() =>
                setPage(
                  (
                    current,
                  ) =>
                    Math.min(
                      totalPages,
                      current +
                        1,
                    ),
                )
              }
            />
          )}
      </ReportCard>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer
        className="
          flex
          min-w-0
          flex-col
          gap-1

          pb-2

          text-[9px]
          leading-4

          text-gray-400

          sm:flex-row
          sm:justify-between
          sm:text-[10px]
        "
      >
        <span>
          SSI Maya Connect •
          Administrative
          Reporting
        </span>

        <span>
          Generated{' '}
          {formatDateTime(
            report?.generatedAt,
          )}
        </span>
      </footer>
    </div>
  );
}

/* ============================================================
   HEADER ACTION
============================================================ */

function HeaderAction({
  children,
  icon,
  onClick,
  disabled = false,
  primary = false,
}: {
  children: ReactNode;

  icon: ReactNode;

  onClick: () => void;

  disabled?: boolean;

  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className={`
        flex
        min-h-[42px]
        min-w-0

        cursor-pointer

        items-center
        justify-center
        gap-1.5

        rounded-lg

        border

        px-2.5

        text-[11px]
        font-semibold

        transition-all

        disabled:cursor-not-allowed
        disabled:opacity-45

        sm:px-3
        sm:text-[12px]

        ${
          primary
            ? `
                border-primary
                bg-primary
                text-white

                hover:brightness-95
              `
            : `
                border-gray-200
                bg-white
                text-secondary

                hover:border-primary/30
                hover:bg-primary/[0.03]
              `
        }
      `}
    >
      {icon}

      <span
        className="
          truncate
        "
      >
        {children}
      </span>
    </button>
  );
}

/* ============================================================
   FILTER FIELD
============================================================ */

function FilterField({
  label,
  children,
}: {
  label: string;

  children: ReactNode;
}) {
  return (
    <label
      className="
        block
        min-w-0
      "
    >
      <span
        className="form-label"
      >
        {label}
      </span>

      {children}
    </label>
  );
}

/* ============================================================
   REPORT CARD
============================================================ */

function ReportCard({
  children,
  printClassName = '',
}: {
  children: ReactNode;

  printClassName?: string;
}) {
  return (
    <section
      className={`
        min-w-0
        max-w-full

        overflow-hidden

        rounded-xl

        border
        border-gray-200

        bg-white

        shadow-sm

        print:break-inside-avoid

        ${printClassName}
      `}
    >
      {children}
    </section>
  );
}

/* ============================================================
   KPI
============================================================ */

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  positive = false,
  loading,
}: {
  title: string;

  value:
    string | number;

  subtitle: string;

  icon: ReactNode;

  positive?: boolean;

  loading: boolean;
}) {
  return (
    <article
      className="
        min-w-0

        rounded-xl

        border
        border-gray-200

        bg-white

        p-3.5

        shadow-sm

        sm:p-4
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-2
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <p
            className="
              truncate

              text-[9px]
              font-semibold

              uppercase

              tracking-[0.04em]

              text-gray-400

              sm:text-[10px]
            "
          >
            {title}
          </p>

          {loading ? (
            <div
              className="
                mt-2

                h-7
                w-14

                animate-pulse

                rounded

                bg-gray-100
              "
            />
          ) : (
            <p
              className={`
                mt-1

                break-words

                font-heading

                text-[22px]
                font-bold

                tracking-[-0.04em]

                sm:text-[25px]

                ${
                  positive
                    ? 'text-primary'
                    : 'text-secondary'
                }
              `}
            >
              {value}
            </p>
          )}

          <p
            className="
              mt-1

              truncate

              text-[9px]

              text-gray-400

              sm:text-[10px]
            "
          >
            {subtitle}
          </p>
        </div>

        <span
          className="
            grid
            h-8
            w-8
            shrink-0
            place-items-center

            rounded-lg

            bg-primary/[0.07]

            text-primary

            sm:h-9
            sm:w-9
          "
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

/* ============================================================
   CHART HEADER
============================================================ */

function ChartHeader({
  title,
  description,
}: {
  title: string;

  description: string;
}) {
  return (
    <div
      className="
        border-b
        border-gray-100

        px-3
        py-3

        sm:px-5
        sm:py-3.5
      "
    >
      <h2
        className="
          text-[13px]
          font-semibold

          text-secondary

          sm:text-[14px]
        "
      >
        {title}
      </h2>

      <p
        className="
          mt-0.5

          text-[9px]
          leading-4

          text-gray-500

          sm:text-[10px]
        "
      >
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   SECTION HEADER
============================================================ */

function SectionHeader({
  title,
  description,
}: {
  title: string;

  description: string;
}) {
  return (
    <div
      className="
        border-b
        border-gray-200

        px-3
        py-3.5

        sm:px-5
        sm:py-4
      "
    >
      <h2
        className="
          text-[14px]
          font-semibold

          text-secondary

          sm:text-[15px]
        "
      >
        {title}
      </h2>

      <p
        className="
          mt-0.5

          text-[10px]
          leading-4

          text-gray-500

          sm:text-[11px]
        "
      >
        {description}
      </p>
    </div>
  );
}

/* ============================================================
   DONUT
============================================================ */

function DonutCard({
  title,
  description,
  data,
  colors,
  centerValue,
  centerLabel,
  loading,
}: {
  title: string;

  description: string;

  data: PieItem[];

  colors: string[];

  centerValue:
    string | number;

  centerLabel: string;

  loading: boolean;
}) {
  const total =
    data.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        item.value,
      0,
    );

  return (
    <ReportCard>
      <ChartHeader
        title={
          title
        }
        description={
          description
        }
      />

      <div
        className="
          relative

          h-[280px]
          min-w-0

          p-2

          sm:h-[330px]
          sm:p-4
        "
      >
        {loading ? (
          <ChartSkeleton />
        ) : total >
          0 ? (
          <>
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={
                    data
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius="52%"
                  outerRadius="74%"
                  paddingAngle={
                    3
                  }
                >
                  {data.map(
                    (
                      _,
                      index,
                    ) => (
                      <Cell
                        key={
                          index
                        }
                        fill={
                          colors[
                            index %
                              colors.length
                          ]
                        }
                      />
                    ),
                  )}
                </Pie>

                <Tooltip
                  contentStyle={
                    tooltipStyle
                  }
                />

                <Legend
                  wrapperStyle={{
                    fontSize:
                      '10px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div
              className="
                pointer-events-none

                absolute
                left-1/2
                top-[46%]

                -translate-x-1/2
                -translate-y-1/2

                text-center
              "
            >
              <p
                className="
                  font-heading

                  text-[20px]
                  font-bold

                  tracking-[-0.04em]

                  text-secondary

                  sm:text-[24px]
                "
              >
                {
                  centerValue
                }
              </p>

              <p
                className="
                  mt-0.5

                  text-[8px]
                  font-medium

                  uppercase

                  tracking-[0.05em]

                  text-gray-400

                  sm:text-[9px]
                "
              >
                {
                  centerLabel
                }
              </p>
            </div>
          </>
        ) : (
          <ChartEmpty />
        )}
      </div>
    </ReportCard>
  );
}

/* ============================================================
   EVENT MOBILE CARD
============================================================ */

function EventPerformanceCard({
  event,
}: {
  event: EventPerformance;
}) {
  return (
    <article
      className="
        min-w-0

        p-3.5

        sm:p-4
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-3
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <h3
            className="
              break-words

              text-[13px]
              font-semibold

              text-secondary
            "
          >
            {
              event.eventName
            }
          </h3>

          <p
            className="
              mt-1

              break-words

              text-[10px]
              leading-4

              text-gray-400
            "
          >
            {event.venue ||
              'Venue not specified'}
          </p>
        </div>

        <EventStatus
          status={
            event.status
          }
        />
      </div>

      <div
        className="
          mt-4

          grid
          grid-cols-3
          gap-2
        "
      >
        <SmallStat
          label="Registered"
          value={
            event.registrations
          }
        />

        <SmallStat
          label="Present"
          value={
            event.present
          }
          positive
        />

        <SmallStat
          label="Absent"
          value={
            event.notPresent
          }
        />
      </div>

      <div
        className="
          mt-4

          grid
          grid-cols-2
          gap-3
        "
      >
        <MobileRate
          label="Attendance"
          value={
            event.attendanceRate
          }
        />

        <MobileRate
          label="Utilization"
          value={
            event.utilization
          }
        />
      </div>

      <div
        className="
          mt-3

          flex
          flex-wrap
          items-center
          gap-x-4
          gap-y-1

          text-[10px]
          text-gray-500
        "
      >
        <span>
          Capacity:{' '}
          <strong
            className="
              text-secondary
            "
          >
            {event.capacity}
          </strong>
        </span>

        <span>
          Reserved:{' '}
          <strong
            className="
              text-secondary
            "
          >
            {
              event.bookedCapacity
            }
          </strong>
        </span>
      </div>
    </article>
  );
}

/* ============================================================
   BOOKING MOBILE CARD
============================================================ */

function BookingMobileCard({
  booking,
}: {
  booking: BookingLedgerRow;
}) {
  return (
    <article
      className="
        min-w-0

        p-3.5

        sm:p-4
      "
    >
      {/* HEADER */}

      <div
        className="
          flex
          min-w-0
          items-start
          justify-between
          gap-3
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <p
            className="
              break-all

              font-mono

              text-[9px]
              font-semibold

              text-primary
            "
          >
            {
              booking.bookingId
            }
          </p>

          <h3
            className="
              mt-1

              break-words

              text-[14px]
              font-semibold

              text-secondary
            "
          >
            {
              booking.fullName
            }
          </h3>

          {(booking.designation ||
            booking.specialty) && (
            <p
              className="
                mt-0.5

                text-[10px]
                leading-4

                text-gray-400
              "
            >
              {[
                booking.designation,
                booking.specialty,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  ' • ',
                )}
            </p>
          )}
        </div>

        <AttendanceBadge
          status={
            booking.attendanceStatus
          }
        />
      </div>

      {/* EVENT */}

      <div
        className="
          mt-3

          rounded-lg

          border
          border-gray-100

          bg-gray-50

          p-3
        "
      >
        <p
          className="
            text-[9px]
            font-medium

            uppercase

            tracking-[0.04em]

            text-gray-400
          "
        >
          Event
        </p>

        <p
          className="
            mt-1

            break-words

            text-[12px]
            font-semibold

            text-gray-700
          "
        >
          {
            booking.eventName
          }
        </p>

        {booking.venue && (
          <p
            className="
              mt-1

              break-words

              text-[10px]
              leading-4

              text-gray-400
            "
          >
            {
              booking.venue
            }
          </p>
        )}
      </div>

      {/* DATA GRID */}

      <div
        className="
          mt-3

          grid
          grid-cols-2
          gap-x-3
          gap-y-3
        "
      >
        <MobileData
          label="Date"
          value={
            formatDate(
              booking.scheduledDate,
            )
          }
        />

        <MobileData
          label="Time"
          value={
            formatSlot(
              booking.startTime,
              booking.endTime,
            )
          }
        />

        <MobileData
          label="Check-in"
          value={
            booking.checkInMethod ||
            '—'
          }
        />

        <MobileData
          label="Checked In"
          value={
            formatDateTimeShort(
              booking.checkedInAt,
            )
          }
        />
      </div>

      {/* CONTACT */}

      {(booking.email ||
        booking.mobile ||
        booking.hospital) && (
        <div
          className="
            mt-3

            border-t
            border-gray-100

            pt-3
          "
        >
          {booking.email && (
            <MobileLine
              label="Email"
              value={
                booking.email
              }
            />
          )}

          {booking.mobile && (
            <MobileLine
              label="Mobile"
              value={
                booking.mobile
              }
            />
          )}

          {booking.hospital && (
            <MobileLine
              label="Hospital"
              value={
                booking.hospital
              }
            />
          )}

          <MobileLine
            label="Registered"
            value={
              formatDateTime(
                booking.createdAt,
              )
            }
          />
        </div>
      )}
    </article>
  );
}

/* ============================================================
   MOBILE DATA
============================================================ */

function MobileData({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      className="
        min-w-0
      "
    >
      <p
        className="
          text-[9px]
          font-medium

          uppercase

          tracking-[0.04em]

          text-gray-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1

          break-words

          text-[11px]
          font-medium

          leading-4

          text-gray-700
        "
      >
        {value}
      </p>
    </div>
  );
}

function MobileLine({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-start
        justify-between
        gap-3

        py-1
      "
    >
      <span
        className="
          shrink-0

          text-[9px]
          text-gray-400
        "
      >
        {label}
      </span>

      <span
        className="
          min-w-0

          break-all

          text-right
          text-[10px]
          font-medium

          text-gray-600
        "
      >
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   SMALL STAT
============================================================ */

function SmallStat({
  label,
  value,
  positive = false,
}: {
  label: string;

  value:
    string | number;

  positive?: boolean;
}) {
  return (
    <div
      className="
        min-w-0

        rounded-lg

        bg-gray-50

        px-2
        py-2.5

        text-center
      "
    >
      <p
        className="
          text-[8px]
          font-medium

          uppercase

          tracking-[0.03em]

          text-gray-400
        "
      >
        {label}
      </p>

      <p
        className={`
          mt-1

          text-[14px]
          font-semibold

          ${
            positive
              ? 'text-primary'
              : 'text-secondary'
          }
        `}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   MOBILE RATE
============================================================ */

function MobileRate({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div
      className="
        min-w-0
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
          gap-2
        "
      >
        <span
          className="
            text-[9px]
            text-gray-400
          "
        >
          {label}
        </span>

        <span
          className="
            text-[10px]
            font-semibold

            text-secondary
          "
        >
          {value}%
        </span>
      </div>

      <div
        className="
          mt-1.5

          h-1.5

          overflow-hidden

          rounded-full

          bg-gray-100
        "
      >
        <div
          className="
            h-full

            rounded-full

            bg-primary
          "
          style={{
            width:
              `${Math.min(
                value,
                100,
              )}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   DESKTOP RATE
============================================================ */

function RateCell({
  value,
}: {
  value: number;
}) {
  return (
    <div
      className="
        min-w-[90px]
      "
    >
      <span
        className="
          font-semibold
          text-secondary
        "
      >
        {value}%
      </span>

      <div
        className="
          mt-1.5

          h-1.5

          overflow-hidden

          rounded-full

          bg-gray-100
        "
      >
        <div
          className="
            h-full

            rounded-full

            bg-primary
          "
          style={{
            width:
              `${Math.min(
                value,
                100,
              )}%`,
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   STATUS
============================================================ */

function EventStatus({
  status,
}: {
  status: string;
}) {
  if (
    status ===
    'LIVE'
  ) {
    return (
      <span
        className="
          badge
          badge--success
          shrink-0
        "
      >
        Live
      </span>
    );
  }

  if (
    status ===
    'COMPLETED'
  ) {
    return (
      <span
        className="
          badge
          badge--info
          shrink-0
        "
      >
        Completed
      </span>
    );
  }

  return (
    <span
      className="
        badge
        badge--warning
        shrink-0
      "
    >
      Upcoming
    </span>
  );
}

function AttendanceBadge({
  status,
}: {
  status: string;
}) {
  return status ===
    'PRESENT' ? (
    <span
      className="
        badge
        badge--success
        shrink-0
      "
    >
      Present
    </span>
  ) : (
    <span
      className="
        badge
        badge--warning
        shrink-0
      "
    >
      Not Present
    </span>
  );
}

/* ============================================================
   PAGINATION
============================================================ */

function MobilePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPrevious,
  onNext,
}: {
  page: number;

  totalPages: number;

  rangeStart: number;

  rangeEnd: number;

  total: number;

  onPrevious: () => void;

  onNext: () => void;
}) {
  return (
    <div
      className="
        flex
        flex-col
        gap-3

        border-t
        border-gray-200

        px-3
        py-3

        sm:flex-row
        sm:items-center
        sm:justify-between

        sm:px-4

        print:hidden
      "
    >
      <p
        className="
          text-center

          text-[10px]
          text-gray-500

          sm:text-left
          sm:text-[11px]
        "
      >
        Showing{' '}
        <strong
          className="
            text-secondary
          "
        >
          {rangeStart}–
          {rangeEnd}
        </strong>{' '}
        of{' '}
        <strong
          className="
            text-secondary
          "
        >
          {total}
        </strong>
      </p>

      <div
        className="
          grid
          grid-cols-[1fr_auto_1fr]
          items-center
          gap-2

          sm:flex
        "
      >
        <button
          type="button"
          disabled={
            page <= 1
          }
          onClick={
            onPrevious
          }
          className="
            btn
            btn-secondary

            min-h-[38px]

            disabled:opacity-40
          "
        >
          Previous
        </button>

        <span
          className="
            px-1

            text-center

            text-[10px]

            text-gray-500
          "
        >
          {page}/{totalPages}
        </span>

        <button
          type="button"
          disabled={
            page >=
            totalPages
          }
          onClick={
            onNext
          }
          className="
            btn
            btn-secondary

            min-h-[38px]

            disabled:opacity-40
          "
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   QUICK FILTER
============================================================ */

function QuickButton({
  children,
  onClick,
}: {
  children: ReactNode;

  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="
        shrink-0
        cursor-pointer

        whitespace-nowrap

        rounded-full

        border
        border-gray-200

        bg-white

        px-2.5
        py-1.5

        text-[9px]
        font-medium

        text-gray-600

        transition-colors

        hover:border-primary/30
        hover:bg-primary/[0.04]
        hover:text-primary

        sm:px-3
        sm:text-[10px]
      "
    >
      {children}
    </button>
  );
}

/* ============================================================
   SKELETONS
============================================================ */

function ChartSkeleton() {
  return (
    <div
      className="
        flex
        h-full
        min-w-0

        animate-pulse

        items-end
        gap-2

        px-2
        pb-3
      "
    >
      {[
        55,
        78,
        48,
        88,
        65,
        95,
        70,
      ].map(
        (
          height,
          index,
        ) => (
          <div
            key={
              index
            }
            className="
              min-w-0
              flex-1

              rounded-t-md

              bg-gray-100
            "
            style={{
              height:
                `${height}%`,
            }}
          />
        ),
      )}
    </div>
  );
}

function TableSkeleton({
  columns,
}: {
  columns: number;
}) {
  return (
    <>
      {Array.from({
        length: 5,
      }).map(
        (
          _,
          row,
        ) => (
          <tr
            key={
              row
            }
          >
            {Array.from({
              length:
                columns,
            }).map(
              (
                __,
                column,
              ) => (
                <td
                  key={
                    column
                  }
                >
                  <div
                    className="
                      h-3
                      w-full
                      max-w-[110px]

                      animate-pulse

                      rounded

                      bg-gray-100
                    "
                  />
                </td>
              ),
            )}
          </tr>
        ),
      )}
    </>
  );
}

function MobileCardSkeleton() {
  return (
    <div
      className="
        animate-pulse
        p-4
      "
    >
      <div
        className="
          flex
          justify-between
          gap-3
        "
      >
        <div
          className="
            flex-1
          "
        >
          <div
            className="
              h-4
              w-2/3

              rounded

              bg-gray-100
            "
          />

          <div
            className="
              mt-2

              h-3
              w-1/2

              rounded

              bg-gray-100
            "
          />
        </div>

        <div
          className="
            h-5
            w-16

            rounded-full

            bg-gray-100
          "
        />
      </div>

      <div
        className="
          mt-4

          grid
          grid-cols-3
          gap-2
        "
      >
        <div className="h-14 rounded-lg bg-gray-100" />
        <div className="h-14 rounded-lg bg-gray-100" />
        <div className="h-14 rounded-lg bg-gray-100" />
      </div>

      <div
        className="
          mt-4

          h-10

          rounded-lg

          bg-gray-100
        "
      />
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <div
      className="
        animate-pulse
        p-4
      "
    >
      <div
        className="
          h-3
          w-32

          rounded

          bg-gray-100
        "
      />

      <div
        className="
          mt-2

          h-5
          w-1/2

          rounded

          bg-gray-100
        "
      />

      <div
        className="
          mt-4

          h-16

          rounded-lg

          bg-gray-100
        "
      />

      <div
        className="
          mt-3

          grid
          grid-cols-2
          gap-3
        "
      >
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-10 rounded bg-gray-100" />
      </div>
    </div>
  );
}

/* ============================================================
   EMPTY
============================================================ */

function ChartEmpty() {
  return (
    <div
      className="
        grid
        h-full
        place-items-center

        px-4

        text-center
      "
    >
      <div>
        <div
          className="
            mx-auto

            grid
            h-10
            w-10
            place-items-center

            rounded-lg

            bg-gray-100

            text-gray-400
          "
        >
          <ChartIcon />
        </div>

        <p
          className="
            mt-2

            text-[10px]
            text-gray-500

            sm:text-[11px]
          "
        >
          No data available
          for this selection.
        </p>
      </div>
    </div>
  );
}

function MobileEmpty({
  text,
}: {
  text: string;
}) {
  return (
    <div
      className="
        px-4
        py-10

        text-center
      "
    >
      <div
        className="
          mx-auto

          grid
          h-10
          w-10
          place-items-center

          rounded-lg

          bg-gray-100

          text-gray-400
        "
      >
        <ChartIcon />
      </div>

      <p
        className="
          mx-auto
          mt-2

          max-w-[260px]

          text-[11px]
          leading-5

          text-gray-500
        "
      >
        {text}
      </p>
    </div>
  );
}

function EmptyRow({
  columns,
  text,
}: {
  columns: number;

  text: string;
}) {
  return (
    <tr>
      <td
        colSpan={
          columns
        }
        className="
          !py-12

          text-center
          text-gray-400
        "
      >
        {text}
      </td>
    </tr>
  );
}

/* ============================================================
   EXPORT
============================================================ */

function buildExportRows(
  bookings:
    BookingLedgerRow[],
) {
  return bookings.map(
    (
      booking,
    ) => ({
      'Booking ID':
        booking.bookingId,

      Name:
        booking.fullName,

      Email:
        booking.email,

      Mobile:
        booking.mobile,

      Designation:
        booking.designation,

      Specialty:
        booking.specialty,

      'Hospital / Institution':
        booking.hospital,

      City:
        booking.city,

      State:
        booking.state,

      Country:
        booking.country,

      Event:
        booking.eventName,

      'Event Type':
        booking.eventType,

      Venue:
        booking.venue,

      'Scheduled Date':
        formatDate(
          booking.scheduledDate,
        ),

      'Time Slot':
        formatSlot(
          booking.startTime,
          booking.endTime,
        ),

      Attendance:
        booking.attendanceStatus ===
        'PRESENT'
          ? 'Present'
          : 'Not Present',

      'Check-in Method':
        booking.checkInMethod,

      'Checked In At':
        formatDateTime(
          booking.checkedInAt,
        ),

      'Checked In By':
        booking.checkedInBy,

      'Registered At':
        formatDateTime(
          booking.createdAt,
        ),
    }),
  );
}

function csvEscape(
  value:
    unknown,
) {
  const text =
    value ===
      undefined ||
    value ===
      null
      ? ''
      : String(
          value,
        );

  return `"${text.replace(
    /"/g,
    '""',
  )}"`;
}

function downloadBlob(
  blob: Blob,
  filename: string,
) {
  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  URL.revokeObjectURL(
    url,
  );
}

function buildFilename(
  prefix: string,
  extension: string,
) {
  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  return `${prefix}-${date}.${extension}`;
}

/* ============================================================
   DATE
============================================================ */

function toDateInput(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function formatDate(
  value:
    string | null | undefined,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(
    date,
  );
}

function formatDateTime(
  value:
    string | null | undefined,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(
    date,
  );
}

function formatDateTimeShort(
  value:
    string | null | undefined,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(
    date,
  );
}

function formatSlot(
  start: string,
  end: string,
) {
  if (
    !start ||
    !end
  ) {
    return '—';
  }

  return `${start} - ${end}`;
}

/* ============================================================
   TOOLTIP
============================================================ */

const tooltipStyle = {
  borderRadius:
    '10px',

  border:
    '1px solid #e5e7eb',

  boxShadow:
    '0 8px 25px rgba(27,75,107,0.08)',

  fontSize:
    '10px',
};

/* ============================================================
   ICONS
============================================================ */

function RefreshIcon({
  spinning,
}: {
  spinning: boolean;
}) {
  return (
    <svg
      className={`
        h-4
        w-4

        ${
          spinning
            ? 'animate-spin'
            : ''
        }
      `}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 11a8 8 0 1 0-2.35 5.65M20 4v7h-7"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"
      />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3h10l4 4v14H5V3Z"
      />

      <path
        strokeLinecap="round"
        d="M15 3v5h5M8 12l5 5m0-5-5 5"
      />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7v-7Z"
      />
    </svg>
  );
}

function BookingIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5V9a2 2 0 0 0 0 4v3.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16.5V13a2 2 0 0 0 0-4V5.5Z"
      />
    </svg>
  );
}

function PresentIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function AbsentIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
      />

      <path
        strokeLinecap="round"
        d="m9 9 6 6m0-6-6 6"
      />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
      />

      <rect
        x="14"
        y="4"
        width="6"
        height="6"
      />

      <rect
        x="4"
        y="14"
        width="6"
        height="6"
      />

      <path
        d="M14 14h2v2h-2v4m4-6h2v2m-2 4h2"
      />
    </svg>
  );
}

function CapacityIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <circle
        cx="17"
        cy="9"
        r="2"
      />

      <path
        strokeLinecap="round"
        d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M15 15c3 0 4.5 1.7 5 5"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        d="M5 19V11m7 8V5m7 14v-6M3 20h18"
      />
    </svg>
  );
}