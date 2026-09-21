export default function BookingDetailsLoading() {
  return (
    <div
      className="
        w-full

        animate-pulse

        pb-10
      "
    >
      {/* BACK */}

      <div
        className="
          h-4
          w-28

          rounded-md

          bg-gray-200/70
        "
      />

      {/* HERO */}

      <div
        className="
          mt-4

          overflow-hidden

          rounded-[20px]

          border
          border-gray-200

          bg-white
        "
      >
        <div
          className="
            p-6
          "
        >
          <div
            className="
              flex

              items-center

              gap-4
            "
          >
            <div
              className="
                h-14
                w-14

                shrink-0

                rounded-[16px]

                bg-gray-100
              "
            />

            <div
              className="
                flex-1
              "
            >
              <div
                className="
                  h-5
                  w-48

                  rounded-md

                  bg-gray-100
                "
              />

              <div
                className="
                  mt-3

                  h-3
                  w-72
                  max-w-full

                  rounded-md

                  bg-gray-100
                "
              />
            </div>

            <div
              className="
                hidden

                h-10
                w-32

                rounded-xl

                bg-gray-100

                sm:block
              "
            />
          </div>
        </div>

        <div
          className="
            grid
            grid-cols-2

            border-t
            border-gray-100

            sm:grid-cols-4
          "
        >
          {Array.from({
            length: 4,
          }).map(
            (
              _,
              index,
            ) => (
              <div
                key={
                  index
                }
                className="
                  border-r
                  border-gray-100

                  p-4

                  last:border-r-0
                "
              >
                <div
                  className="
                    h-2.5
                    w-16

                    rounded

                    bg-gray-100
                  "
                />

                <div
                  className="
                    mt-2

                    h-3
                    w-[75%]

                    rounded

                    bg-gray-100
                  "
                />
              </div>
            ),
          )}
        </div>
      </div>

      {/* CONTENT */}

      <div
        className="
          mt-5

          grid

          gap-5

          xl:grid-cols-[1.3fr_0.7fr]
        "
      >
        <div
          className="
            space-y-5
          "
        >
          <LoadingCard
            rows={7}
          />

          <LoadingCard
            rows={6}
          />

          <LoadingCard
            rows={5}
          />
        </div>

        <div
          className="
            space-y-5
          "
        >
          <LoadingCard
            rows={3}
          />

          <LoadingCard
            rows={4}
          />

          <LoadingCard
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

function LoadingCard({
  rows,
}: {
  rows: number;
}) {
  return (
    <div
      className="
        overflow-hidden

        rounded-[18px]

        border
        border-gray-200

        bg-white
      "
    >
      <div
        className="
          flex

          items-center

          gap-3

          border-b
          border-gray-100

          px-5
          py-4
        "
      >
        <div
          className="
            h-9
            w-9

            rounded-xl

            bg-gray-100
          "
        />

        <div>
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

              h-2.5
              w-44

              rounded

              bg-gray-100
            "
          />
        </div>
      </div>

      <div
        className="
          p-5
        "
      >
        {Array.from({
          length:
            rows,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={
                index
              }
              className="
                border-b
                border-gray-100

                py-3

                last:border-0
              "
            >
              <div
                className="
                  h-2.5
                  w-20

                  rounded

                  bg-gray-100
                "
              />

              <div
                className="
                  mt-2

                  h-3
                  w-[68%]

                  rounded

                  bg-gray-100
                "
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}