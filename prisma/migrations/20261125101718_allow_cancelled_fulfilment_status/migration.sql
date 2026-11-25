ALTER TABLE "fulfilment_arrangements"
DROP CONSTRAINT "fulfilment_arrangements_status_check";

ALTER TABLE "fulfilment_arrangements"
ADD CONSTRAINT "fulfilment_arrangements_status_check"
CHECK (
    "status" IN (
        'PENDING',
        'CONFIRMED',
        'DECLINED',
        'CANCELLED'
    )
);