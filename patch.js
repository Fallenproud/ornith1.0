const fs = require('fs');
let code = fs.readFileSync('src/lib/artifacts.ts', 'utf8');
code = code.replace(/export interface PackageBundleOptions/g, 'export interface PackageDownloadOptions');
code = code.replace(/export async function packageAndDownloadArtifactZip\(\n  options: PackageBundleOptions\n\): Promise<{ success: boolean; fileName: string; sizeBytes: number }> {/g, 
`export async function packageForDownload(
  artifactOrOptions: ModelArtifact | PackageDownloadOptions,
  run?: TrainingRun | null,
  project?: ProjectMetadata | null
): Promise<{ success: boolean; fileName: string; sizeBytes: number }> {
  let options: PackageDownloadOptions;
  if ('artifact' in artifactOrOptions && artifactOrOptions.artifact) {
    options = {
      artifact: artifactOrOptions.artifact,
      run: artifactOrOptions.run || run,
      project: artifactOrOptions.project || project,
      includeInferenceScripts: artifactOrOptions.includeInferenceScripts !== false,
    };
  } else {
    options = {
      artifact: artifactOrOptions as ModelArtifact,
      run,
      project,
      includeInferenceScripts: true,
    };
  }`);
fs.writeFileSync('src/lib/artifacts.ts', code);
