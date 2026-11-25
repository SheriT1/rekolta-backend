
BEGIN;

-- Add optional message and counterproposal fields
ALTER TABLE "fulfilment_arrangements"
    ADD COLUMN "message" VARCHAR(500),
    ADD COLUMN "counter_method" VARCHAR(20),
    ADD COLUMN "counter_delivery_address" VARCHAR(255),
    ADD COLUMN "counter_pickup_point" VARCHAR(255),
    ADD COLUMN "counter_preferred_date" DATE,
    ADD COLUMN "counter_preferred_time" TIME(0),
    ADD COLUMN "counter_message" VARCHAR(500);

-- Extend the existing arrangement status constraint
ALTER TABLE "fulfilment_arrangements"
    DROP CONSTRAINT "fulfilment_arrangements_status_check";

ALTER TABLE "fulfilment_arrangements"
    ADD CONSTRAINT "fulfilment_arrangements_status_check"
    CHECK (
        "status" IN (
            'PENDING',
            'COUNTERPROPOSED',
            'CONFIRMED',
            'DECLINED',
            'CANCELLED'
        )
    );

-- Validate counterproposal method
ALTER TABLE "fulfilment_arrangements"
    ADD CONSTRAINT "fulfilment_counter_method_check"
    CHECK (
        "counter_method" IS NULL
        OR "counter_method" IN ('PICKUP', 'DELIVERY')
    );

-- Validate counterproposal details
ALTER TABLE "fulfilment_arrangements"
    ADD CONSTRAINT "valid_counterproposal_details"
    CHECK (
        (
            "counter_method" IS NULL
            AND "counter_delivery_address" IS NULL
            AND "counter_pickup_point" IS NULL
            AND "counter_preferred_date" IS NULL
            AND "counter_preferred_time" IS NULL
            AND "counter_message" IS NULL
        )
        OR
        (
            "counter_method" IS NOT NULL
            AND "counter_preferred_date" IS NOT NULL
            AND (
                (
                    "counter_method" = 'DELIVERY'
                    AND "counter_delivery_address" IS NOT NULL
                    AND "counter_pickup_point" IS NULL
                )
                OR
                (
                    "counter_method" = 'PICKUP'
                    AND "counter_pickup_point" IS NOT NULL
                    AND "counter_delivery_address" IS NULL
                )
            )
        )
    );

-- Require a counterproposal when awaiting restaurant response
ALTER TABLE "fulfilment_arrangements"
    ADD CONSTRAINT "counterproposal_required_check"
    CHECK (
        "status" <> 'COUNTERPROPOSED'
        OR (
            "counter_method" IS NOT NULL
            AND "counter_preferred_date" IS NOT NULL
        )
    );

COMMIT;
