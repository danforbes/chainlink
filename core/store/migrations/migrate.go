package migrations

import (
	"regexp"

	"github.com/jinzhu/gorm"
	"github.com/pkg/errors"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration0"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1559081901"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1559767166"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1560433987"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1560791143"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1560881846"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1560881855"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1560886530"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1560924400"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1564007745"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1565139192"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1565210496"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1565291711"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1565877314"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1566498796"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1566915476"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1567029116"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1568280052"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1568833756"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1570087128"
	"github.com/smartcontractkit/chainlink/core/store/migrations/migration1570675883"
	gormigrate "gopkg.in/gormigrate.v1"
)

// Migrate iterates through available migrations, running and tracking
// migrations that have not been run.
func Migrate(db *gorm.DB) error {
	return MigrateTo(db, "")
}

// MigrateTo runs all migrations up to and including the specified migration ID
func MigrateTo(db *gorm.DB, migrationID string) error {
	options := *gormigrate.DefaultOptions
	options.UseTransaction = true

	migrations := []*gormigrate.Migration{
		{
			ID:      "0",
			Migrate: migration0.Migrate,
		},
		{
			ID:      "1559081901",
			Migrate: migration1559081901.Migrate,
		},
		{
			ID:      "1559767166",
			Migrate: migration1559767166.Migrate,
		},
		{
			ID:      "1560433987",
			Migrate: migration1560433987.Migrate,
		},
		{
			ID:      "1560791143",
			Migrate: migration1560791143.Migrate,
		},
		{
			ID:      "1560881846",
			Migrate: migration1560881846.Migrate,
		},
		{
			ID:      "1560886530",
			Migrate: migration1560886530.Migrate,
		},
		{
			ID:      "1560924400",
			Migrate: migration1560924400.Migrate,
		},
		{
			ID:      "1560881855",
			Migrate: migration1560881855.Migrate,
		},
		{
			ID:      "1565139192",
			Migrate: migration1565139192.Migrate,
		},
		{
			ID:      "1564007745",
			Migrate: migration1564007745.Migrate,
		},
		{
			ID:      "1565210496",
			Migrate: migration1565210496.Migrate,
		},
		{
			ID:      "1566498796",
			Migrate: migration1566498796.Migrate,
		},
		{
			ID:      "1565877314",
			Migrate: migration1565877314.Migrate,
		},
		{
			ID:      "1566915476",
			Migrate: migration1566915476.Migrate,
		},
		{
			ID:      "1567029116",
			Migrate: migration1567029116.Migrate,
		},
		{
			ID:      "1568280052",
			Migrate: migration1568280052.Migrate,
		},
		{
			ID:      "1565291711",
			Migrate: migration1565291711.Migrate,
		},
		{
			ID:      "1568833756",
			Migrate: migration1568833756.Migrate,
		},
		{
			ID:      "1570087128",
			Migrate: migration1570087128.Migrate,
		},
		{
			ID:      "1570675883",
			Migrate: migration1570675883.Migrate,
		},
	}

	m := gormigrate.New(db, &options, migrations)

	var count int
	err := db.Table(options.TableName).Count(&count).Error
	if err != nil && !noSuchTableRegex.MatchString(err.Error()) {
		return errors.Wrap(err, "error determining migration count")
	}

	if count > len(migrations) {
		return errors.New("database is newer than current chainlink version")
	}

	if migrationID == "" {
		migrationID = migrations[len(migrations)-1].ID
	}

	err = m.MigrateTo(migrationID)
	if err != nil {
		return errors.Wrap(err, "error running migrations")
	}
	return nil
}

var (
	noSuchTableRegex = regexp.MustCompile(`^(no such table|pq: relation ".*?" does not exist)`)
)
