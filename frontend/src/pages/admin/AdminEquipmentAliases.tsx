import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Eye, EyeOff, Camera, Settings } from "lucide-react";
import {
  useCameraAliases,
  type CameraAlias,
  type CameraAliasFilters,
} from "../../hooks/useCameraAliases";
import {
  useLensAliases,
  type LensAlias,
  type LensAliasFilters,
} from "../../hooks/useLensAliases";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import EquipmentAliasForm from "../../components/EquipmentAliasForm";

type EquipmentType = "cameras" | "lenses";
type AliasType = CameraAlias | LensAlias;

interface EquipmentConfig {
  type: EquipmentType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  columns: Array<{
    key: string;
    title: string;
    render: (alias: AliasType) => React.ReactNode;
  }>;
  filters: {
    searchPlaceholder: string;
    additionalFilters?: React.ReactNode;
  };
}

const AdminEquipmentAliases: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get active tab from URL or default to cameras
  const getTabFromPath = (): EquipmentType => {
    const hash = location.hash.replace("#", "");
    return hash === "lenses" ? "lenses" : "cameras";
  };

  const [activeTab, setActiveTab] = useState<EquipmentType>(getTabFromPath());
  const [editingAlias, setEditingAlias] = useState<AliasType | null>(null);

  // Camera state
  const [cameraSearchQuery, setCameraSearchQuery] = useState("");
  const [cameraBrandFilter, setCameraBrandFilter] = useState("");
  const [cameraActiveFilter, setCameraActiveFilter] = useState<
    boolean | undefined
  >(undefined);
  const [cameraCurrentPage, setCameraCurrentPage] = useState(1);

  // Lens state
  const [lensSearchQuery, setLensSearchQuery] = useState("");
  const [lensBrandFilter, setLensBrandFilter] = useState("");
  const [lensMountFilter, setLensMountFilter] = useState("");
  const [lensActiveFilter, setLensActiveFilter] = useState<boolean | undefined>(
    undefined,
  );
  const [lensCurrentPage, setLensCurrentPage] = useState(1);

  // Update URL when tab changes
  useEffect(() => {
    void navigate(`#${activeTab}`, { replace: true });
  }, [activeTab, navigate]);

  // Camera filters
  const cameraFilters: CameraAliasFilters = {
    search: cameraSearchQuery.trim() === "" ? undefined : cameraSearchQuery,
    brand: cameraBrandFilter.trim() === "" ? undefined : cameraBrandFilter,
    is_active: cameraActiveFilter,
    page: cameraCurrentPage,
    per_page: 20,
  };

  // Lens filters
  const lensFilters: LensAliasFilters = {
    search: lensSearchQuery.trim() === "" ? undefined : lensSearchQuery,
    brand: lensBrandFilter.trim() === "" ? undefined : lensBrandFilter,
    mount_type: lensMountFilter.trim() === "" ? undefined : lensMountFilter,
    is_active: lensActiveFilter,
    page: lensCurrentPage,
    per_page: 20,
  };

  const {
    data: cameraData,
    isLoading: cameraLoading,
    error: cameraError,
  } = useCameraAliases(cameraFilters);
  const {
    data: lensData,
    isLoading: lensLoading,
    error: lensError,
  } = useLensAliases(lensFilters);

  const handleEditAlias = (alias: AliasType) => {
    setEditingAlias(alias);
  };

  const handleFormSuccess = () => {
    setEditingAlias(null);
  };

  const handleFormCancel = () => {
    setEditingAlias(null);
  };

  const clearCameraFilters = () => {
    setCameraSearchQuery("");
    setCameraBrandFilter("");
    setCameraActiveFilter(undefined);
    setCameraCurrentPage(1);
  };

  const clearLensFilters = () => {
    setLensSearchQuery("");
    setLensBrandFilter("");
    setLensMountFilter("");
    setLensActiveFilter(undefined);
    setLensCurrentPage(1);
  };

  // Equipment configurations
  const equipmentConfigs: Record<EquipmentType, EquipmentConfig> = {
    cameras: {
      type: "cameras",
      title: "Camera Aliases",
      icon: Camera,
      columns: [
        {
          key: "original_name",
          title: "Original Name",
          render: (alias: AliasType) => (
            <span className="font-mono text-sm">{alias.original_name}</span>
          ),
        },
        {
          key: "display_name",
          title: "Display Name",
          render: (alias: AliasType) => (
            <span className="font-medium">{alias.display_name}</span>
          ),
        },
        {
          key: "brand",
          title: "Brand",
          render: (alias: AliasType) => (
            <span className="text-muted-foreground">
              {(alias as CameraAlias).brand ?? "-"}
            </span>
          ),
        },
        {
          key: "model",
          title: "Model",
          render: (alias: AliasType) => (
            <span className="text-muted-foreground">
              {(alias as CameraAlias).model ?? "-"}
            </span>
          ),
        },
        {
          key: "status",
          title: "Status",
          render: (alias: AliasType) => (
            <Badge
              variant={alias.is_active ? "default" : "secondary"}
              className="gap-1"
            >
              {alias.is_active ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {alias.is_active ? "Active" : "Inactive"}
            </Badge>
          ),
        },
      ],
      filters: {
        searchPlaceholder: "Search camera aliases...",
        additionalFilters: (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Filter by brand..."
              value={cameraBrandFilter}
              onChange={(e) => setCameraBrandFilter(e.target.value)}
            />
            <select
              value={
                cameraActiveFilter === undefined
                  ? ""
                  : cameraActiveFilter.toString()
              }
              onChange={(e) =>
                setCameraActiveFilter(
                  e.target.value === "" ? undefined : e.target.value === "true",
                )
              }
              className="px-3 py-2 border border-input rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <Button variant="outline" onClick={clearCameraFilters}>
              Clear Filters
            </Button>
          </div>
        ),
      },
    },
    lenses: {
      type: "lenses",
      title: "Lens Aliases",
      icon: Settings,
      columns: [
        {
          key: "original_name",
          title: "Original Name",
          render: (alias: AliasType) => (
            <span className="font-mono text-sm">{alias.original_name}</span>
          ),
        },
        {
          key: "display_name",
          title: "Display Name",
          render: (alias: AliasType) => (
            <span className="font-medium">{alias.display_name}</span>
          ),
        },
        {
          key: "brand",
          title: "Brand",
          render: (alias: AliasType) => (
            <span className="text-muted-foreground">
              {(alias as LensAlias).brand ?? "-"}
            </span>
          ),
        },
        {
          key: "focal_length",
          title: "Focal Length",
          render: (alias: AliasType) => (
            <span className="text-muted-foreground">
              {(alias as LensAlias).focal_length ?? "-"}
            </span>
          ),
        },
        {
          key: "mount_type",
          title: "Mount",
          render: (alias: AliasType) => (
            <span className="text-muted-foreground">
              {(alias as LensAlias).mount_type ?? "-"}
            </span>
          ),
        },
        {
          key: "status",
          title: "Status",
          render: (alias: AliasType) => (
            <Badge
              variant={alias.is_active ? "default" : "secondary"}
              className="gap-1"
            >
              {alias.is_active ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {alias.is_active ? "Active" : "Inactive"}
            </Badge>
          ),
        },
      ],
      filters: {
        searchPlaceholder: "Search lens aliases...",
        additionalFilters: (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Filter by brand..."
              value={lensBrandFilter}
              onChange={(e) => setLensBrandFilter(e.target.value)}
            />
            <Input
              placeholder="Filter by mount..."
              value={lensMountFilter}
              onChange={(e) => setLensMountFilter(e.target.value)}
            />
            <select
              value={
                lensActiveFilter === undefined
                  ? ""
                  : lensActiveFilter.toString()
              }
              onChange={(e) =>
                setLensActiveFilter(
                  e.target.value === "" ? undefined : e.target.value === "true",
                )
              }
              className="px-3 py-2 border border-input rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <Button variant="outline" onClick={clearLensFilters}>
              Clear Filters
            </Button>
          </div>
        ),
      },
    },
  };

  const currentConfig = equipmentConfigs[activeTab];
  const currentData = activeTab === "cameras" ? cameraData : lensData;
  const isLoading = activeTab === "cameras" ? cameraLoading : lensLoading;
  const error = activeTab === "cameras" ? cameraError : lensError;
  const currentSearchQuery =
    activeTab === "cameras" ? cameraSearchQuery : lensSearchQuery;
  const setCurrentSearchQuery =
    activeTab === "cameras" ? setCameraSearchQuery : setLensSearchQuery;
  const currentPage =
    activeTab === "cameras" ? cameraCurrentPage : lensCurrentPage;
  const setCurrentPage =
    activeTab === "cameras" ? setCameraCurrentPage : setLensCurrentPage;

  const aliases = currentData?.aliases ?? [];
  const totalPages = currentData?.pages ?? 0;
  const Icon = currentConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Equipment Aliases
          </h1>
          <p className="text-muted-foreground">
            Manage display names for cameras and lenses found in photo metadata
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as EquipmentType)}
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="cameras" className="gap-2">
            <Camera className="h-4 w-4" />
            Cameras
          </TabsTrigger>
          <TabsTrigger value="lenses" className="gap-2">
            <Settings className="h-4 w-4" />
            Lenses
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value={activeTab} className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={currentConfig.filters.searchPlaceholder}
                  value={currentSearchQuery}
                  onChange={(e) => setCurrentSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {currentConfig.filters.additionalFilters}
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                {currentConfig.title}
                {currentData && (
                  <Badge variant="secondary" className="ml-auto">
                    {currentData.total} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  <p>Error loading {activeTab} aliases. Please try again.</p>
                </div>
              ) : (
                <>
                  {aliases.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No {activeTab} aliases found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {currentConfig.columns.map((column) => (
                              <TableHead key={column.key}>
                                {column.title}
                              </TableHead>
                            ))}
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {aliases.map((alias) => (
                              <TableRow
                                key={alias.id}
                                className="group cursor-pointer hover:bg-muted/50"
                              >
                                {currentConfig.columns.map((column) => (
                                  <TableCell key={column.key}>
                                    {column.render(alias)}
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditAlias(alias)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
                              }
                              disabled={currentPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCurrentPage(
                                  Math.min(totalPages, currentPage + 1),
                                )
                              }
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Form */}
      {editingAlias && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                Edit {activeTab === "cameras" ? "Camera" : "Lens"} Alias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EquipmentAliasForm
                alias={editingAlias}
                type={activeTab}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default AdminEquipmentAliases;
