import React, { useState } from "react";
import { Folder, FolderOpen, FileCode, FileText, File, ChevronRight, ChevronDown } from "lucide-react";

function getFileIcon(fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  switch (ext) {
    case "py":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "html":
    case "css":
    case "json":
      return <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />;
    case "md":
    case "txt":
      return <FileText className="w-4 h-4 text-emerald-400 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TreeNode({ node, onSelectFile, selectedPath, depth = 0 }) {
  const [isOpen, setIsOpen] = useState(depth === 0);

  if (node.type === "directory") {
    return (
      <div className="select-none">
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-800/60 active:bg-slate-800 cursor-pointer text-slate-200 text-xs font-medium transition"
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="truncate">{node.name || "workspace"}</span>
        </div>

        {isOpen && node.children && (
          <div className="flex flex-col">
            {node.children.map((child, index) => (
              <TreeNode
                key={child.path || `${child.name}-${index}`}
                node={child}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
      className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer text-xs transition ${
        isSelected
          ? "bg-indigo-950/80 text-indigo-300 font-medium border border-indigo-800/50"
          : "text-slate-300 hover:bg-slate-800/40 active:bg-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        {getFileIcon(node.name)}
        <span className="truncate">{node.name}</span>
      </div>
      <span className="text-[10px] text-slate-500 font-mono ml-2 shrink-0">
        {formatBytes(node.size)}
      </span>
    </div>
  );
}

export default function FileTree({ tree, onSelectFile, selectedPath, searchQuery = "" }) {
  if (!tree) {
    return <div className="text-xs text-slate-500 p-4">No workspace files loaded.</div>;
  }

  // Filter tree flattened if search is non-empty
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    const matches = [];

    function searchRec(node) {
      if (node.type === "file" && node.name.toLowerCase().includes(query)) {
        matches.push(node);
      }
      if (node.children) {
        node.children.forEach(searchRec);
      }
    }
    searchRec(tree);

    return (
      <div className="space-y-1 p-1">
        {matches.length === 0 ? (
          <div className="text-xs text-slate-500 p-4 text-center">No matching files found.</div>
        ) : (
          matches.map((file) => (
            <div
              key={file.path}
              onClick={() => onSelectFile(file.path)}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 active:bg-slate-800 cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                {getFileIcon(file.name)}
                <div className="truncate">
                  <div className="text-slate-200 font-medium truncate">{file.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{file.path}</div>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">
                {formatBytes(file.size)}
              </span>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <TreeNode node={tree} onSelectFile={onSelectFile} selectedPath={selectedPath} depth={0} />
    </div>
  );
}
