import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Make sure this path is correct based on your setup
import { Search, Mail, Calendar, Trash2, Download } from 'lucide-react';

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch messages from Firebase Firestore
  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'contactMessages'));
      const fetchedMessages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by newest first
      fetchedMessages.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      alert("Failed to load messages from cloud.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const filteredMessages = messages.filter(msg => 
    (msg.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (msg.lastName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (msg.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (msg.subject?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Update Status in Firebase
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'contactMessages', id), { status: newStatus });
      setMessages(messages.map(msg => msg.id === id ? { ...msg, status: newStatus } : msg));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  // Delete from Firebase
  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this message?")) {
      try {
        await deleteDoc(doc(db, 'contactMessages', id));
        setMessages(messages.filter(msg => msg.id !== id));
      } catch (error) {
        console.error("Error deleting message:", error);
        alert("Failed to delete message. Check your permissions.");
      }
    }
  };

  // Export to CSV
  const handleExport = () => {
    if (messages.length === 0) {
      alert("No messages to export.");
      return;
    }
    const headers = ['Date', 'First Name', 'Last Name', 'Email', 'Phone', 'Subject', 'Message', 'Status'];
    const csvRows = [headers.join(',')];

    messages.forEach(msg => {
      const row = [
        new Date(msg.createdAt).toLocaleDateString(),
        `"${msg.firstName || ''}"`,
        `"${msg.lastName || ''}"`,
        `"${msg.email || ''}"`,
        `"${msg.phone || ''}"`,
        `"${msg.subject || ''}"`,
        `"${(msg.message || '').replace(/"/g, '""')}"`, // Escape quotes in message
        msg.status || 'pending'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laxardo_Inquiries_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-display uppercase tracking-tight">Contact Messages</h1>
          <p className="text-brand-secondary font-sans mt-1">Manage customer inquiries and support requests</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-brand-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          <Download size={16} />
          <span className="text-sm font-semibold uppercase tracking-wider">Export CSV</span>
        </button>
      </div>

      <div className="bg-white border border-brand-divider shadow-sm">
        <div className="p-6 border-b border-brand-divider">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-secondary" size={18} />
            <input
              type="text"
              placeholder="Search by name, email or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-brand-bg border border-brand-divider pl-12 pr-4 py-3 font-sans focus:outline-none focus:border-brand-black transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-divider">
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Customer</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Subject</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Message</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Date</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Status</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-divider">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center font-sans text-brand-secondary">
                    No contact messages found in Cloud.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-6">
                      <div>
                        <p className="font-medium text-brand-black">{msg.firstName} {msg.lastName}</p>
                        <p className="text-xs font-sans text-brand-secondary">{msg.email}</p>
                        <p className="text-xs font-sans text-brand-secondary mt-1">{msg.phone}</p>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-brand-secondary" />
                        <span className="font-sans text-sm capitalize">{msg.subject}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <p className="text-sm font-sans text-brand-secondary max-w-xs truncate" title={msg.message}>
                        {msg.message}
                      </p>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2 text-brand-secondary text-sm">
                        <Calendar size={14} />
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="p-6">
                      <select
                        value={msg.status || 'pending'}
                        onChange={(e) => handleStatusChange(msg.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-none focus:ring-1 focus:ring-brand-black cursor-pointer ${
                          msg.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                          msg.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          msg.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="contacted">Contacted</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>
                    <td className="p-6 text-right">
                       <button 
                         onClick={() => handleDelete(msg.id)}
                         className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                         title="Delete Message"
                       >
                         <Trash2 size={18} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}