ALTER TABLE public.reports
DROP CONSTRAINT reports_status_check;

ALTER TABLE public.reports
ADD CONSTRAINT reports_status_check
CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED'));