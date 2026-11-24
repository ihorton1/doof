import React from "react";
import { NewIdeaForm } from "../../../components/idea-forms";
import { BoltShell } from "../../../components/bolt-shell";

export default function NewIdeaPage() {
  return (
    <BoltShell>
      <NewIdeaForm />
    </BoltShell>
  );
}
