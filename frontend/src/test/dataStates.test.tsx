import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBox } from "@/components/DataStates";
import { ApiError } from "@/services/api";

afterEach(cleanup);

describe("ErrorBox retry", () => {
  const err = (status: number) => new ApiError({ status, message: "boom" });
  it("offers retry for transient failures", () => {
    render(<ErrorBox error={err(503)} onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
  it.each([429, 404])("offers no retry when HTTP %i (retrying cannot change the outcome)", (status) => {
    render(<ErrorBox error={err(status)} onRetry={() => {}} />);
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
