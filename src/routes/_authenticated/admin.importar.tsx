import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useCategories, useInvalidate } from "@/lib/queries";
import { CSV_COLUMNS, CSV_HELP, downloadText, parseCsv, saveRecipe, templateCsv, validateRows, type RowCheck } from "@/lib/recipe-import";

export const Route = createFileRoute("/_authenticated/admin/importar")({
  component: ImportPage,
});

function ImportPage() {
  const cats = useCategories();
  const invalidate = useInvalidate();
  const [checks, setChecks] = useState<RowCheck[] | null>(null);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  async function onFile(file: File) {
    const text = await file.text();
    const res = validateRows(parseCsv(text), (cats.data ?? []).map((c) => c.slug));
    setChecks(res.checks);
    setHeaderErrors(res.headerErrors);
    setFailures([]);
  }

  const valid = (checks ?? []).filter((c) => c.draft);
  const invalid = (checks ?? []).filter((c) => !c.draft);
  const incomplete = valid.filter((c) => c.missing.length);

  async function runImport() {
    const slugMap = new Map((cats.data ?? []).map((c) => [c.slug, c.id]));
    const fails: string[] = [];
    setProgress(0);
    for (let i = 0; i < valid.length; i++) {
      try {
        await saveRecipe(valid[i]!.draft!, slugMap);
      } catch (e) {
        fails.push(`Fila ${valid[i]!.row}: ${e instanceof Error ? e.message : "error"}`);
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }
    setFailures(fails);
    invalidate("admin_recipes", "recipes", "planner_recipes", "ingredients");
    toast.success(`Importación terminada: ${valid.length - fails.length} recetas guardadas`);
  }

  return (
    <div className="space-y-6">
      <div className="card-soft space-y-3 p-5">
        <h2 className="text-xl">1. Prepará el archivo</h2>
        <p className="text-sm text-muted-foreground">
          Una fila por receta, en formato CSV (se puede exportar desde Excel o Google Sheets). Si el número de receta ya existe, se actualiza en lugar de duplicarse.
        </p>
        <Button variant="outline" onClick={() => downloadText("plantilla-recetas.csv", templateCsv())}><Download /> Descargar plantilla</Button>
        <details className="text-sm">
          <summary className="cursor-pointer text-primary">Ver qué va en cada columna</summary>
          <dl className="mt-3 grid gap-2">
            {CSV_COLUMNS.map((c) => (
              <div key={c}><dt className="font-mono text-xs">{c}</dt><dd className="text-muted-foreground">{CSV_HELP[c]}</dd></div>
            ))}
          </dl>
        </details>
      </div>

      <div className="card-soft space-y-3 p-5">
        <h2 className="text-xl">2. Revisá antes de guardar</h2>
        <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {headerErrors.map((h) => <p key={h} className="text-sm text-destructive">{h}</p>)}
        {checks && (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{checks.length}</strong> filas · <strong className="text-primary">{valid.length}</strong> se pueden importar ·{" "}
              <strong className="text-destructive">{invalid.length}</strong> con errores · <strong>{incomplete.length}</strong> con datos pendientes
            </p>
            {invalid.length > 0 && (
              <div className="rounded-xl bg-destructive/10 p-3">
                <p className="font-medium">Filas con errores (no se importan):</p>
                {invalid.slice(0, 50).map((c) => <p key={c.row}>Fila {c.row}: {c.errors.join("; ")}</p>)}
              </div>
            )}
            {incomplete.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl bg-warning p-3 text-warning-foreground">
                <p className="font-medium">Se importan, pero no entran al planificador hasta completarlas:</p>
                {incomplete.slice(0, 300).map((c) => <p key={c.row}>Fila {c.row} ({c.draft!.name}): falta {c.missing.join(", ")}</p>)}
              </div>
            )}
            <Button onClick={runImport} disabled={!valid.length || progress !== null && progress < 100}><Upload /> Importar {valid.length} recetas</Button>
            {progress !== null && <Progress value={progress} />}
            {failures.map((f) => <p key={f} className="text-destructive">{f}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
