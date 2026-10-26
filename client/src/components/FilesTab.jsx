import React, { useState, useEffect } from "react";
import { FolderPlus, FilePlus, Search, RefreshCw, FolderTree, AlertCircle } from "lucide-react";
import FileTree from "./FileTree";
import CodeEditor from "./CodeEditor";
import { getWorkspaceTree, getFileContent, executeWorkspaceAction } from "../api";

export default function FilesTab() {
  const [tree, setTree] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [isBinary, setIsBinary] = useState(false);
  const [isFetchingFile, setIsFetchingFile] = useState(false);
  const [error, setError] = useState(null);
  const [newModalType, setNewModalType] = useState(null); // "file" or "folder"
  const [newItemName, setNewItemName] = useState("");

  const loadTree = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWorkspaceTree();
      setTree(data.tree);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const handleSelectFile = async (path) => {
    setIsFetchingFile(true);
    setError(null);
    try {
      const res = await getFileContent(path);
      setActiveFile(path);
      setFileContent(res.content);
      setIsBinary(res.is_binary || false);
    } catch (err) {
      setError(`Failed to open ${path}: ${err.message}`);
    } finally {
      setIsFetchingFile(false);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      const action = newModalType === "file" ? "create_file" : "create_dir";
      await executeWorkspaceAction(action, newItemName.trim());
      setNewModalType(null);
      setNewItemName("");
      await loadTree();
      if (action === "create_file") {
        handleSelectFile(newItemName.trim());
      }
    } catch (err) {
      alert(`Error creating item: ${err.message}`);
    }
  };

  if (activeFile) {
    return (
      <CodeEditor
        filePath={activeFile}
        initialContent={fileContent}
        isBinary={isBinary}
        onClose={() => setActiveFile(null)}
      />
    );
  }

  return (
    <div className="space-y-3 pb-20">
      {/* Search & Actions Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={() => { setNewModalType("file"); setNewItemName(""); }}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition"
          title="New File"
        >
          <FilePlus className="w-4 h-4" />
        </button>

        <button
          onClick={() => { setNewModalType("folder"); setNewItemName(""); }}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition"
          title="New Folder"
        >
          <FolderPlus className="w-4 h-4" />
        </button>

        <button
          onClick={loadTree}
          disabled={isLoading}
          className="p-2 rounded-xl bg-indigo-900/30 border border-indigo-800/40 text-indigo-300 active:scale-95 transition"
          title="Reload Tree"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tree Container */}
      <div className="p-3 rounded-2xl bg-gravity-card border border-gravity-border min-h-[300px]">
        {isLoading && !tree ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-indigo-400 mb-2" />
            <p className="text-xs">Scanning workspace directory...</p>
          </div>
        ) : (
          <FileTree
            tree={tree}
            onSelectFile={handleSelectFile}
            selectedPath={activeFile}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Creation Modal */}
      {newModalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-2">
              Create New {newModalType === "file" ? "File" : "Directory"}
            </h3>
            <form onSubmit={handleCreateItem}>
              <input
                type="text"
                autoFocus
                placeholder={newModalType === "file" ? "path/to/new_file.py" : "path/to/new_folder"}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 mb-3 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewModalType(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium active:scale-95"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
