export const projectFileParentPath = (relativePath: string) => {
  const separator = relativePath.lastIndexOf("/");
  return separator < 0 ? "" : relativePath.slice(0, separator);
};

export const canNavigateProjectFilesUp = (relativePath: string, rootPath: string) =>
  relativePath !== rootPath &&
  (rootPath === "" || relativePath.startsWith(`${rootPath}/`));

export const projectFilePathUp = (relativePath: string, rootPath: string) => {
  if (!canNavigateProjectFilesUp(relativePath, rootPath)) return rootPath;
  const parent = projectFileParentPath(relativePath);
  return rootPath === "" || parent === rootPath || parent.startsWith(`${rootPath}/`)
    ? parent
    : rootPath;
};
