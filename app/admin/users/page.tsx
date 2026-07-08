"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Power, Trash2, Users as UsersIcon } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Card from "@/components/Card";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Select from "@/components/Select";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  addUser,
  deleteUser,
  getUsers,
  resetPassword,
  setUserStatus,
  updateUser,
} from "@/lib/api";
import { UserRecord, UserRole } from "@/types";

const ROLE_OPTIONS = [
  { label: "User", value: "user" },
  { label: "Admin", value: "admin" },
];

function UserManagementContent() {
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<{ username: string; password: string; name: string; role: UserRole }>({
    username: "",
    password: "",
    name: "",
    role: "user",
  });

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: UserRole }>({ name: "", role: "user" });

  const [resettingUser, setResettingUser] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function loadUsers() {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const data = await getUsers(currentUser.username);
      setUsers(data);
    } catch (err) {
      showError("Could not load users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.username]);

  async function handleAddUser(e: FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!addForm.username.trim() || !addForm.password.trim() || !addForm.name.trim()) {
      showError("Username, password, and name are required.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await addUser({ requestedBy: currentUser.username, ...addForm });
      if (res.success) {
        showSuccess("User created.");
        setShowAddModal(false);
        setAddForm({ username: "", password: "", name: "", role: "user" });
        loadUsers();
      } else {
        showError(res.message || "Could not create user.");
      }
    } catch (err) {
      showError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function openEdit(u: UserRecord) {
    setEditingUser(u);
    setEditForm({ name: u.name, role: u.role });
  }

  async function handleEditUser(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !editingUser) return;
    setIsSaving(true);
    try {
      const res = await updateUser({
        requestedBy: currentUser.username,
        username: editingUser.username,
        name: editForm.name,
        role: editForm.role,
      });
      if (res.success) {
        showSuccess("User updated.");
        setEditingUser(null);
        loadUsers();
      } else {
        showError(res.message || "Could not update user.");
      }
    } catch (err) {
      showError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(u: UserRecord) {
    if (!currentUser) return;
    const nextStatus = u.status === "disabled" ? "active" : "disabled";
    try {
      const res = await setUserStatus({
        requestedBy: currentUser.username,
        username: u.username,
        status: nextStatus,
      });
      if (res.success) {
        showSuccess(nextStatus === "disabled" ? "User disabled." : "User enabled.");
        loadUsers();
      } else {
        showError(res.message || "Could not update user status.");
      }
    } catch (err) {
      showError("Network error. Please try again.");
    }
  }

  async function handleDeleteUser(u: UserRecord) {
    if (!currentUser) return;
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try {
      const res = await deleteUser({ requestedBy: currentUser.username, username: u.username });
      if (res.success) {
        showSuccess("User deleted.");
        loadUsers();
      } else {
        showError(res.message || "Could not delete user.");
      }
    } catch (err) {
      showError("Network error. Please try again.");
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !resettingUser) return;
    if (!newPassword.trim()) {
      showError("Please enter a new password.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await resetPassword({
        requestedBy: currentUser.username,
        username: resettingUser.username,
        newPassword,
      });
      if (res.success) {
        showSuccess("Password reset.");
        setResettingUser(null);
        setNewPassword("");
      } else {
        showError(res.message || "Could not reset password.");
      }
    } catch (err) {
      showError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <TopBar title="User Management" showBack />

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-5">
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-5 w-5" /> Add User
        </Button>

        {isLoading ? (
          <Loader label="Loading users..." />
        ) : users.length === 0 ? (
          <Card className="text-center text-sm font-body text-ink-400">No users found.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((u) => {
              const isSelf = u.username.toLowerCase() === currentUser?.username.toLowerCase();
              return (
                <Card key={u.username} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-700">
                        <UsersIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-ink-900">{u.name}</p>
                        <p className="text-xs font-body text-ink-400">@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          u.role === "admin" ? "bg-ink-800 text-white" : "bg-ink-50 text-ink-600"
                        }`}
                      >
                        {u.role}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          u.status === "disabled" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 active:scale-95"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setResettingUser(u)}
                      className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 active:scale-95"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Reset Password
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={isSelf}
                      className="flex items-center gap-1 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 active:scale-95 disabled:opacity-40"
                    >
                      <Power className="h-3.5 w-3.5" /> {u.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      disabled={isSelf}
                      className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 active:scale-95 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <Modal title="Add User" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddUser} className="flex flex-col gap-4">
            <Input
              label="Username"
              value={addForm.username}
              onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
            <Input
              label="Password"
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
            <Input
              label="Full Name"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={addForm.role}
              onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            />
            <Button type="submit" isLoading={isSaving}>
              Create User
            </Button>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Edit ${editingUser.username}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEditUser} className="flex flex-col gap-4">
            <Input
              label="Full Name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={editForm.role}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            />
            <Button type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
          </form>
        </Modal>
      )}

      {resettingUser && (
        <Modal
          title={`Reset Password for ${resettingUser.username}`}
          onClose={() => {
            setResettingUser(null);
            setNewPassword("");
          }}
        >
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Button type="submit" isLoading={isSaving}>
              Reset Password
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <ProtectedRoute adminOnly>
      <UserManagementContent />
    </ProtectedRoute>
  );
}
