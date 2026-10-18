import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  IconLoader2,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconTrash,
  IconClock,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Progress,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingSkeleton,
} from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import { JOB_STATUS_CONFIG, JOB_TYPE_LABELS } from "@/lib/constants";
import { useConfirm } from "@/lib/hooks";
import type { Job, JobStatus } from "@/lib/types";

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Job[]>("get_all_jobs", { status: null });
      setJobs(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelJob = async (id: string) => {
    try {
      await invoke("cancel_job", { id });
      toast.success("Job cancelled");
      loadJobs();
    } catch (e) {
      toast.error("Failed to cancel job");
    }
  };

  const handleDeleteJob = async (id: string) => {
    const ok = await confirm({
      title: "Delete job?",
      description: "This will permanently remove this job record.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await invoke("delete_job", { id });
      toast.success("Job deleted");
      loadJobs();
    } catch (e) {
      toast.error("Failed to delete job");
    }
  };

  const handleDeleteAllFinished = async () => {
    const ok = await confirm({
      title: "Delete all job history?",
      description: "This will permanently remove all completed, failed, and cancelled jobs.",
      confirmLabel: "Delete All",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      const count = await invoke<number>("delete_all_finished_jobs");
      toast.success(`Deleted ${count} job${count === 1 ? "" : "s"}`);
      loadJobs();
    } catch (e) {
      toast.error("Failed to delete jobs");
    }
  };

  const runningJobs = jobs.filter((j) => j.status === "running");
  const pendingJobs = jobs.filter((j) => j.status === "pending");
  const completedJobs = jobs.filter((j) => ["completed", "failed", "cancelled"].includes(j.status));

  return (
    <PageLayout
      title="Jobs"
      subtitle="Monitor and manage background analysis jobs"
      action={{
        label: "Refresh",
        onClick: loadJobs,
      }}
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {isLoading && jobs.length === 0 ? (
        <LoadingSkeleton rows={3} columns={4} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<IconClock className="h-8 w-8 text-muted-foreground" />}
          title="No jobs yet"
          description="Start an analysis from a brand's page to create jobs."
          secondaryAction={
            <Link to="/brands" className="text-sm text-primary hover:underline">
              Go to Brands
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {runningJobs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <IconPlayerPlay className="h-5 w-5 text-primary" />
                Running ({runningJobs.length})
              </h2>
              <div className="space-y-3">
                {runningJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onCancel={() => handleCancelJob(job.id)}
                    onDelete={() => handleDeleteJob(job.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {pendingJobs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <IconClock className="h-5 w-5 text-muted-foreground" />
                Pending ({pendingJobs.length})
              </h2>
              <div className="space-y-3">
                {pendingJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onCancel={() => handleCancelJob(job.id)}
                    onDelete={() => handleDeleteJob(job.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {completedJobs.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">History ({completedJobs.length})</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteAllFinished}
                >
                  <IconTrash className="h-4 w-4 mr-1" />
                  Delete All
                </Button>
              </div>
              <div className="space-y-3">
                {completedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onCancel={() => handleCancelJob(job.id)}
                    onDelete={() => handleDeleteJob(job.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </PageLayout>
  );
}

function JobCard({
  job,
  onCancel,
  onDelete,
}: {
  job: Job;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const status = job.status as JobStatus;
  const config = JOB_STATUS_CONFIG[status] || JOB_STATUS_CONFIG.pending;
  const isRunning = status === "running";
  const isPending = status === "pending";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {isRunning ? (
                <IconLoader2 className="h-5 w-5 animate-spin text-primary" />
              ) : status === "completed" ? (
                <IconCheck className="h-5 w-5 text-positive" />
              ) : status === "failed" ? (
                <IconX className="h-5 w-5 text-negative" />
              ) : (
                <IconClock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {JOB_TYPE_LABELS[job.jobType] || job.jobType}
                </span>
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Created {formatRelativeTime(job.createdAt)}
                {job.completedAt && ` • Completed ${formatRelativeTime(job.completedAt)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(isRunning || isPending) && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {!isRunning && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                aria-label="Delete job"
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {isRunning && job.progress > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span>{job.progress}%</span>
            </div>
            <Progress value={job.progress} />
          </div>
        )}

        {status === "failed" && job.error && (
          <div className="mt-3 p-3 bg-negative/10 rounded-md">
            <p className="text-sm text-negative">{job.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
